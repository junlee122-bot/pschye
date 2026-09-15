/** Convert only embedded WebP images to lossless PNG for glTFast.
 * Usage: node tools/3d/prepare-raon-unity-runtime.mjs [--sharp-module <module path>]
 * Geometry, morphs, inverse bind matrices and animation accessors remain byte-identical.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const align = value => (value + 3) & ~3;

export function parseGlb(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'GLB magic');
  assert.equal(bytes.readUInt32LE(4), 2, 'GLB version');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB total length');
  let json, bin;
  for (let offset = 12; offset < bytes.length;) {
    const size = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    assert.equal(size % 4, 0, 'GLB chunk alignment');
    assert.ok(offset + 8 + size <= bytes.length, 'GLB chunk bounds');
    const chunk = bytes.subarray(offset + 8, offset + 8 + size);
    if (type === 0x4e4f534a) { assert.equal(json, undefined); json = JSON.parse(chunk.toString('utf8')); }
    else if (type === 0x004e4942) { assert.equal(bin, undefined); bin = chunk; }
    else throw new Error(`Unsupported GLB chunk ${type}`);
    offset += 8 + size;
  }
  assert.ok(json && bin);
  assert.equal(json.buffers.length, 1);
  assert.ok(!json.buffers[0].uri);
  assert.ok(json.buffers[0].byteLength <= bin.length);
  return { json, bin };
}

function packGlb(json, bin) {
  const text = Buffer.from(JSON.stringify(json));
  const jsonChunk = Buffer.alloc(align(text.length), 0x20); text.copy(jsonChunk);
  const binChunk = Buffer.alloc(align(bin.length)); bin.copy(binChunk);
  const output = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + binChunk.length);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jsonChunk.length, 12); output.writeUInt32LE(0x4e4f534a, 16); jsonChunk.copy(output, 20);
  const offset = 20 + jsonChunk.length;
  output.writeUInt32LE(binChunk.length, offset); output.writeUInt32LE(0x004e4942, offset + 4); binChunk.copy(output, offset + 8);
  return output;
}

function viewBytes(source, index) {
  const view = source.json.bufferViews[index];
  assert.equal(view.buffer, 0);
  const start = view.byteOffset ?? 0;
  assert.ok(start + view.byteLength <= source.json.buffers[0].byteLength);
  return source.bin.subarray(start, start + view.byteLength);
}

export async function convertRaon(sourceBytes, sharp) {
  const source = parseGlb(sourceBytes), json = structuredClone(source.json);
  const replacements = new Map(), pixels = [];
  for (const [index, image] of (json.images ?? []).entries()) {
    assert.equal(image.mimeType, 'image/webp', `Expected embedded WebP image ${index}`);
    assert.equal(image.uri, undefined);
    const original = viewBytes(source, image.bufferView);
    const decoded = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const png = await sharp(decoded.data, { raw: decoded.info }).png({ compressionLevel: 9 }).toBuffer();
    const roundTrip = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(roundTrip.info.width, decoded.info.width);
    assert.equal(roundTrip.info.height, decoded.info.height);
    assert.ok(roundTrip.data.equals(decoded.data), `Image ${index}: RGBA pixels changed`);
    assert.ok(!replacements.has(image.bufferView), 'Shared image buffer view requires explicit handling');
    replacements.set(image.bufferView, png);
    image.mimeType = 'image/png';
    pixels.push({ index, name: image.name, width: decoded.info.width, height: decoded.info.height,
      rgbaSha256: hash(decoded.data), rgbaPixelsIdentical: true, sourceBytes: original.length, pngBytes: png.length });
  }
  for (const accessor of json.accessors ?? []) {
    for (const view of [accessor.bufferView, accessor.sparse?.indices.bufferView, accessor.sparse?.values.bufferView]) {
      assert.ok(view === undefined || !replacements.has(view), 'Image data overlaps an accessor view');
    }
  }
  const textureMappings = [];
  for (const [index, texture] of (json.textures ?? []).entries()) {
    const extension = texture.extensions?.EXT_texture_webp;
    assert.ok(extension && Number.isInteger(extension.source), `Texture ${index}: missing WebP image mapping`);
    assert.ok(json.images[extension.source], 'Texture source in bounds');
    textureMappings.push({ index, source: extension.source });
    texture.source = extension.source;
    delete texture.extensions.EXT_texture_webp;
    if (Object.keys(texture.extensions).length === 0) delete texture.extensions;
  }
  for (const key of ['extensionsUsed', 'extensionsRequired']) {
    if (json[key]) { json[key] = json[key].filter(name => name !== 'EXT_texture_webp'); if (!json[key].length) delete json[key]; }
  }
  const chunks = []; let length = 0;
  for (const [index, view] of json.bufferViews.entries()) {
    const contents = replacements.get(index) ?? viewBytes(source, index);
    if (length % 4) { const padding = Buffer.alloc(align(length) - length); chunks.push(padding); length += padding.length; }
    view.byteOffset = length; view.byteLength = contents.length;
    chunks.push(contents); length += contents.length;
  }
  json.buffers[0].byteLength = length;
  const output = packGlb(json, Buffer.concat(chunks));
  const rebuilt = parseGlb(output);
  const preservedViews = [];
  for (const [index, view] of rebuilt.json.bufferViews.entries()) {
    assert.equal(view.byteOffset % 4, 0);
    if (!replacements.has(index)) {
      const original = viewBytes(source, index), final = viewBytes(rebuilt, index);
      assert.ok(final.equals(original), `Non-image view ${index} changed`);
      preservedViews.push({ index, byteLength: final.length, sha256: hash(final) });
    }
  }
  // Whitelist only container/image/texture changes; every other JSON value must be identical.
  const preservedJson = object => Object.fromEntries(Object.entries(object).filter(([key]) =>
    !['buffers', 'bufferViews', 'images', 'textures', 'extensionsUsed', 'extensionsRequired'].includes(key)));
  assert.deepEqual(preservedJson(rebuilt.json), preservedJson(source.json));
  return { output, report: { status: 'pass', sourceSha256: hash(sourceBytes), outputSha256: hash(output),
    sourceBytes: sourceBytes.length, outputBytes: output.length, imageCount: pixels.length, pixels, textureMappings,
    preservedNonImageBufferViews: preservedViews, geometryRigMorphAnimationJsonIdentical: true,
    nonImageBufferViewsByteIdentical: true, pngPixelRoundTripIdentical: true,
    fourByteAlignmentValid: true, sourceExtensionsRequired: source.json.extensionsRequired ?? [],
    outputExtensionsRequired: rebuilt.json.extensionsRequired ?? [],
    actualUnityEditorValidation: false } };
}

async function main() {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--sharp-module'), 'Use --sharp-module <path>');
  const require = createRequire(import.meta.url);
  let sharp;
  try { sharp = require(args[1] ?? 'sharp'); }
  catch { throw new Error('sharp is required. Install sharp or pass --sharp-module <resolved module path>.'); }
  const input = path.join(repo, 'public/models/characters/raon/raon-production-v2.glb');
  const output = path.join(repo, 'unity/PsycheAdventure/Assets/StreamingAssets/Raon/raon-unity-runtime.glb');
  const reportPath = path.join(repo, 'artifacts/3d/unity/raon-unity-runtime-conversion.json');
  const bytes = await fs.readFile(input), result = await convertRaon(bytes, sharp);
  assert.equal(hash(await fs.readFile(input)), result.report.sourceSha256, 'Source remained unchanged');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, result.output);
  assert.equal(hash(await fs.readFile(output)), result.report.outputSha256);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify({ checkedAt: new Date().toISOString(),
    input: path.relative(repo, input).replaceAll('\\', '/'), output: path.relative(repo, output).replaceAll('\\', '/'),
    tool: 'tools/3d/prepare-raon-unity-runtime.mjs', sharpVersion: sharp.versions.sharp, ...result.report }, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.report.status, images: result.report.imageCount,
    sourceSha256: result.report.sourceSha256, outputSha256: result.report.outputSha256,
    outputBytes: result.output.length, reportPath }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
