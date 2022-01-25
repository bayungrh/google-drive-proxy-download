const express = require('express');
const compression = require('compression');
const hanlder = require('./handler');

const PORT = process.env.NODE_PORT || 4000;
const app = express();

app.use(express.json());
app.use(compression());

app.get('/', (_, res) => res.json({ message: 'OK' }));
app.get('/download', hanlder.download);

app.listen(PORT, function () {
  console.log(`server running at http://localhost:${PORT}`);
});
