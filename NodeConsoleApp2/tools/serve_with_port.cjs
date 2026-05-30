'use strict';

const { createServer } = require('../app.js');

const port = Number.parseInt(process.argv[2] || process.env.PORT, 10) || 3000;

createServer().listen(port, () => {
  console.log(`Static server running at http://127.0.0.1:${port}/`);
});
