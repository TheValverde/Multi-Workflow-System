#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.",
  );
  process.exit(1);
}

const RAW_TEXT_ROOT = path.resolve("RAW_TEXT");
const policiesJsonPath = path.join(RAW_TEXT_ROOT, "policies.json");
const exemplarsRoot = path.join(RAW_TEXT_ROOT, "exemplars");

async function seedPolicies() {
  if (!fs.existsSync(policiesJsonPath)) {
    console.log(
      `No ${policiesJsonPath} file found. Skipping policy seed import.`,
    );
    return;
  }
  const payload = JSON.parse(fs.readFileSync(policiesJsonPath, "utf-8"));
  if (!Array.isArray(payload)) {
    console.warn("policies.json must export an array");
    return;
  }
  console.log(`Seeding ${payload.length} policies…`);
  for (const entry of payload) {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/contract_policies`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            title: entry.title,
            category: entry.category ?? null,
            summary: entry.summary ?? null,
            body: entry.body,
            tags: entry.tags ?? [],
          }),
        },
      );
      if (!response.ok) {
        const error = await response.json();
        console.warn(
          `Failed to insert policy "${entry.title}": ${error.message}`,
        );
      } else {
        const data = await response.json();
        console.log(`Inserted policy "${data[0].title}"`);
      }
    } catch (error) {
      console.error(`Error seeding policy "${entry.title}"`, error);
    }
  }
}

async function uploadExemplars() {
  if (!fs.existsSync(exemplarsRoot)) {
    console.log(
      `No ${exemplarsRoot} directory found. Skipping exemplar upload.`,
    );
    return;
  }
  const types = fs.readdirSync(exemplarsRoot);
  for (const type of types) {
    const typeDir = path.join(exemplarsRoot, type);
    if (!fs.statSync(typeDir).isDirectory()) continue;
    const files = fs.readdirSync(typeDir);
    for (const filename of files) {
      const absolutePath = path.join(typeDir, filename);
      if (!fs.statSync(absolutePath).isFile()) continue;
      const fileBuffer = fs.readFileSync(absolutePath);
      const storagePath = `${type}/${Date.now()}-${filename}`;
      try {
        const uploadRes = await fetch(
          `${SUPABASE_URL}/storage/v1/object/policy-exemplars/${storagePath}`,
          {
            method: "POST",
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/octet-stream",
            },
            body: fileBuffer,
          },
        );
        if (!uploadRes.ok) {
          const error = await uploadRes.json();
          console.warn(
            `Failed to upload exemplar ${filename}: ${error.message}`,
          );
          continue;
        }
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/contract_exemplars`,
          {
            method: "POST",
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              title: path.parse(filename).name,
              type,
              summary: null,
              storage_path: storagePath,
              tags: [],
              uploaded_by: "Seed Script",
            }),
          },
        );
        if (!response.ok) {
          const error = await response.json();
          console.warn(
            `Failed to insert exemplar ${filename}: ${error.message}`,
          );
        } else {
          console.log(`Uploaded exemplar ${filename} (${type})`);
        }
      } catch (error) {
        console.error(`Error uploading exemplar ${filename}`, error);
      }
    }
  }
}

const run = async () => {
  await seedPolicies();
  await uploadExemplars();
  console.log("Policy seeding completed.");
};

run();

