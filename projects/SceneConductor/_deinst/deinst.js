// Remove EXT_mesh_gpu_instancing from a GLB by baking instances into nodes.
// Keeps WebP textures as-is. Drops Draco here (re-added by the CLI afterwards).
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, KHRDracoMeshCompression } = require('@gltf-transform/extensions');
const { uninstance, prune } = require('@gltf-transform/functions');
const draco3d = require('draco3dgltf');

(async () => {
  const inPath = process.argv[2];
  const outPath = process.argv[3] || inPath;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
    });
  const doc = await io.read(inPath);
  await doc.transform(uninstance(), prune());
  // Drop Draco extension so a plain (uncompressed-geometry) GLB is written;
  // the CLI step re-applies Draco cleanly without an encoder dependency here.
  doc.getRoot().listExtensionsUsed().forEach((ext) => {
    if (ext.extensionName === 'KHR_draco_mesh_compression') ext.dispose();
  });
  await io.write(outPath, doc);
  console.log('deinstanced ->', outPath);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
