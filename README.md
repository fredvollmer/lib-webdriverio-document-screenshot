# webdriverio-docShot
WebdriverIO plugin to save a screenshot of the entire screenshot document.  
*Re-worked from [documentScreenshot](https://github.com/webdriverio/webdrivercss/blob/master/lib/documentScreenshot.js) from [WebdriverCSS](https://github.com/webdriverio/webdrivercss)*

## Usage
```js
var webdriverio = require('webdriverio');
var docShot = require('webdriverio-docShot');

var client = webdriverio.remote(capabilities);
client.addCommand('docShot', docShot);

client
    .init()
    .windowHandleSize({
        width: 1200,
        height: 1000
    })
    .url('http://mysite.com')
    .docShot('mysite-screenshot.png', {
        /**
         * Time (in ms) to pause between each scroll and screenshot
         * @default 0
         * @type {Number}
         */
        shotDelay: 500,
        /**
         * Indicates if docShot should scroll and stitch together screenshots of the entire document
         * @default true
         * @type {Boolean}
         */
        shouldScroll: true
    })
    .end();
```

## Libraries
* Plugin for [WebdriverIO](https://github.com/webdriverio/webdriverio)  
* [GraphicsMagick](https://github.com/aheckmann/gm) for image manipulation  
* [fs-extra](https://github.com/jprichardson/node-fs-extra/) for handy file system utilities  
