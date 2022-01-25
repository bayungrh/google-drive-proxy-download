const axios = require('axios').default;
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const jar = new CookieJar();
const Client = wrapper(axios.create({
  jar,
  headers: {
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.99 Safari/537.36'
  }
}));

class Downloader {
  constructor(driveId) {
    this.driveId = driveId;
    this._cookies = '';
    this._confirmToken = '';
    this.url = `https://docs.google.com/uc?export=download&id=${driveId}`;
  }
  
  setCookie(cookies) {
    this._cookies = cookies;
    return this;
  }

  setConfirmToken(token) {
    this._confirmToken = token;
    return this;
  }

  getFileInfo(driveId) {
    driveId = driveId || this.driveId;
    return axios.get(`https://www.googleapis.com/drive/v3/files/${driveId}?key=${process.env.GOOGLE_API_KEY}`)
      .then(res => res.data)
      .catch(() => null);
  }

  _generateDownloadToken() {
    const cookies = this._cookies;
    let downloadToken = null;
    if (!cookies) return null;
    cookies.forEach((cook) => {
      if (cook.startsWith('download_warning')) {
        downloadToken = cook;
        return;
      }
    });
    if (!downloadToken) return null;

    downloadToken = downloadToken.split(';');
    downloadToken.forEach((token) => {
      if (token.startsWith('download_warning')) {
        downloadToken = token.split('=')[1];
        return;
      }
    });
    this._confirmToken = downloadToken;
    return downloadToken;
  }

  _parseFileName(disposition){
    let tmpName;
    disposition.forEach((pos) => {
      if (pos.startsWith('filename=')) {
        tmpName = pos.split('=')[1]; return;
      }
    });
    return tmpName ? tmpName.replace(/"/g, '') : tmpName;
  }

  async downloadStream(fileName, tries = 0) {
    if (tries >= 3) {
      throw new Error('Too many retries');
    }

    if (this._confirmToken) {
      this.url += `&confirm=${this._confirmToken}`;
    }
    const headers = {
      'origin': 'https://drive.google.com',
      'accept-encoding': 'gzip, deflate, br',
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
    };

    if (this._cookies) {
      headers['Cookie'] = this._cookies;
    }

    return Client({
      url: this.url,
      method: 'GET',
      maxRedirects: 2,
      responseType: 'stream',
      headers
    }).then(async (req) => {
      const fileInfo = await this.getFileInfo();
  
      if (!fileInfo) {
        const err = new Error('file not found');
        err.code = 404;
        throw err;
      }

      console.log('Connecting to', req.request.res.responseUrl);
      const contentType = req.headers['content-type'];
      const contentSize = parseInt(req.headers['content-length']);

      fileName = fileInfo.name;
      // if ('content-disposition' in req.headers) {
      //   const contentDisposition = req.headers['content-disposition'].split(';');
      //   console.log('contentDisposition', contentDisposition);
      //   fileName = this._parseFileName(contentDisposition);
      // }
      return {
        stream: req.data,
        file: {
          contentType, contentSize, fileName
        }
      }
    }).catch((error) => {
      if (error.code !== 404) {
        console.log('Retrying', tries);
        this.url = error.request._currentUrl;
        return this.downloadStream(fileName, tries+1);
      }
      throw error;
    })
  }
}

module.exports = {
  Downloader, Client
}
