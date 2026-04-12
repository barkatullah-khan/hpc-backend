module.exports = fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(next); // This .catch(next) sends errors to the global handler!
  };
};