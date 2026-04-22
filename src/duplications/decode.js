export function decodeDuplications(payload) {
  const duplications = payload?.duplications || [];
  const files = Object.fromEntries((payload?.files || []).map((file) => [file.key, file]));

  return duplications.map((duplication, index) => ({
    index,
    blocks: (duplication.blocks || []).map((block) => ({
      component: block.ref ? files[block.ref]?.key || block.ref : block.component,
      name: block.ref ? files[block.ref]?.name : undefined,
      from: block.from,
      size: block.size,
      to: block.from && block.size ? block.from + block.size - 1 : undefined
    }))
  }));
}
