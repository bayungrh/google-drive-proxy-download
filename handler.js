const ProgressBar = require('progress');
const contentDisposition = require('content-disposition');
const { Downloader, Client }  = require('./lib');

module.exports.download = async (req, res) => {
  const driveId = req.query.id;
  if (!driveId) return res.send({
    code: 400,
    message: 'Invalid file id'
  });
  const downloader = new Downloader(driveId);

  let url = `https://docs.google.com/uc?export=download&id=${driveId}`;
  let cancel = false;
  let finished = false;

  const request = await Client.get(url, { 
    withCredentials: true,
    credentials: 'include'
  });
  req.on('close', () => {
    console.log('closed connection');
    cancel = true;
    req.destroy();
    return;
  });

  if (cancel || finished) {
    res.status(500).send('some error');
    return;
  }

  const cookies = request.headers['set-cookie'];
  downloader.setCookie(cookies);

  const download = async () => {
    const { stream, file } = await downloader.downloadStream();
    const progressBar = new ProgressBar('-> downloading [:bar] :percent :etas', {
      width: 50,
      complete: '=',
      incomplete: ' ',
      renderThrottle: 1,
      total: parseInt(file.contentSize)
    });

    stream.on('data', (chunk) => progressBar.tick(chunk.length));
    stream.on('end', function() {
      console.log('end');
      finished = true;
    });

    res.setHeader('Content-Disposition', contentDisposition(file.fileName, { type: 'attachment' }));
    res.setHeader('Content-Length', file.contentSize);
    stream.pipe(res);
  }

  try {
    if ('content-disposition' in request.headers) {
      await download();
      return;
    }
  
    downloader._generateDownloadToken();
    await download()
  } catch (error) {
    res.send(error.message);
  }
}
