const errorHandler = (err, req, res, next) => {
    console.error('Global error:', err.message, err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
  };
  
  module.exports = { errorHandler };