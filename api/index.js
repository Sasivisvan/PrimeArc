module.exports = async (req, res) => {
  const mod = await import('../backend/server.js');
  return mod.default(req, res);
};
