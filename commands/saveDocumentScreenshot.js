/* jshint node: true */
'use strict';

/**
 *
 * Save a screenshot as a base64 encoded image with the current state of the browser.
 *
 * <example>
    :docShot.js
    client
        .windowHandleSize({width: 500, height: 500})
        .docShot('wholeScreen.png') // makes screenshot of whole document
        .end();
 * </example>
 *
 * @param {String}   fileName    path of generated image (relative to the execution directory)
 *
 * @uses protocol/execute, protocol/screenshot, protocol/pause
 * @type utility
 *
 */

/* global document,window */

var fs = require('fs-extra');
var gm = require('gm');
var rimraf = require('rimraf');
var generateUUID = require('../utils/generateUUID.js');
var path = require('path');

var q = require('q');

module.exports = function documentScreenshot(fileName) {


    var ErrorHandler = this.ErrorHandler;

    /*!
     * parameter check
     */
    if (typeof fileName !== 'string') {
        throw new ErrorHandler.CommandError('typeof file name is "' + (typeof fileName) + '". Should be "string"');
    }

    var client = this;

    var pageInfo = null;
    var tmpDir = null;
    var cropImages = [];
    var x = 0;
    var y = 0;

    var scrollFn = function scrollFn(w, h) {
        /**
         * IE8 or older
         */
        if(document.all && !document.addEventListener) {
            /**
             * this still might not work
             * seems that IE8 scroll back to 0,0 before taking screenshots
             */
            document.body.style.marginTop = '-' + h + 'px';
            document.body.style.marginLeft = '-' + w + 'px';
            return;
        }

        document.body.style.webkitTransform = 'translate(-' + w + 'px, -' + h + 'px)';
        document.body.style.mozTransform = 'translate(-' + w + 'px, -' + h + 'px)';
        document.body.style.msTransform = 'translate(-' + w + 'px, -' + h + 'px)';
        document.body.style.oTransform = 'translate(-' + w + 'px, -' + h + 'px)';
        document.body.style.transform = 'translate(-' + w + 'px, -' + h + 'px)';
    };

    return q()

        /*!
         * create tmp directory to cache viewport shots
         */
        .then(function makeTmpDir(){
            var deferred = q.defer();

            var uuid = generateUUID();
            tmpDir = path.join(__dirname, '..', '.tmp-' + uuid);

            fs.mkdirs(tmpDir, '0755', deferred.resolve);

            return deferred.promise;
        })

        /*!
         * prepare page scan
         */
        .then(function prepPageScan(){
            // console.log('In prep page scan');
            return client.execute(function getPageInfo() {
                /**
                 * remove scrollbars
                 */
                // reset height in case we're changing viewports
                document.body.style.height = 'auto';
                document.body.style.height = document.documentElement.scrollHeight + 'px';
                document.body.style.overflow = 'hidden';

                /**
                 * scroll back to start scanning
                 */
                window.scrollTo(0, 0);

                /**
                 * get viewport width/height and total width/height
                 */
                return {
                    screenWidth: Math.max(document.documentElement.clientWidth, window.innerWidth || 0),
                    screenHeight: Math.max(document.documentElement.clientHeight, window.innerHeight || 0),
                    documentWidth: document.documentElement.scrollWidth,
                    documentHeight: document.documentElement.scrollHeight,
                    devicePixelRatio: window.devicePixelRatio
                };
            }).then(function storePageInfo(res) { pageInfo = res.value; });
        })

        /*!
         * take viewport shots and cache them into tmp dir
         */
        .then(function cacheViewportShots() {
            // console.log('cacheViewportShots || In');

            // While runner
            var repeater = function repeater(condition, body) {
                if (!condition()) { return; }

                return body().then(function runNextBody() {
                    return repeater(condition, body);
                });
            };

            // While condition
            var checkPos = function checkPos() {
                return x < (
                    pageInfo.documentWidth /
                    pageInfo.screenWidth
                );
            };

            // While body
            var loop = function loop() {
                // console.log('loop || In');

                var deferred = q.defer();

                // Take viewport screenshot
                deferred.resolve( client.screenshot.bind(client)() );

                var promise = deferred.promise;

                return promise

                    .then(function cacheImage(res) {
                        // console.log('cacheImage || In');

                        var deferred = q.defer();

                        var tmpFileName = tmpDir + '/' + x + '-' + y + '.png';
                        var image = gm(new Buffer(res.value, 'base64'));

                        if (pageInfo.devicePixelRatio > 1) {
                            var percent = 100 / pageInfo.devicePixelRatio;
                            image.resize(percent, percent, "%");
                        }

                        image.crop(pageInfo.screenWidth, pageInfo.screenHeight, 0, 0);
                        

                        if (!cropImages[x]) {
                            cropImages[x] = [];
                        }

                        cropImages[x][y] = tmpFileName;

                        y++;

                        var docBottom = Math.floor(
                            pageInfo.documentHeight /
                            pageInfo.screenHeight
                        );

                        if (y > docBottom) {
                            y = 0;
                            x++;
                        }

                        image.write(tmpFileName, deferred.resolve);

                        return deferred.promise;
                    })

                    .then(function scrollToNext() {
                        // console.log('scrollToNext || In');
                        return client
                            .execute(scrollFn, x * pageInfo.screenWidth, y * pageInfo.screenHeight)
                            .pause(100);
                    });
            };

            // Start 'while loop'
            return repeater(checkPos, loop);

        })

        /*!
         * ensure that filename exists
         */
        .then(function ensureDestinationFile() {
            // console.log('ensureDestinationFile || In');
            var dir = fileName.replace(/[^\/ \\]*\.(png|jpe?g|gif|tiff?)$/,'');
            return fs.mkdirsSync(dir);
        })

        /*!
         * concats all shots
         */
        .then(function concatAllShots() {
            // console.log('concatAllShots || In');
            var subImg = 0;

            var screenshot = null;

            var concatCol = function concatCol(verticalShotArray){
                var deferred = q.defer();
                
                // Convert array of filenames to a gm image
                var col = gm(verticalShotArray.shift());
                col.append.apply(col, verticalShotArray);

                if (!screenshot) {
                    // First screenshot
                    screenshot = col;
                    col.write(fileName, deferred.resolve);

                } else {
                    // Previous columns saved. Concat col to existing image.
                    var subImgPath = tmpDir + '/' + (++subImg) + '.png';
                    col.write(subImgPath, function handleWriteCol() {
                        gm(fileName)
                            .append(subImgPath, true)
                            .write(fileName, deferred.resolve);
                    });
                }
                return deferred.promise;
            };

            return cropImages.reduce(function columnsToPromiseChain(last, next) {
                return last.then(function concatNextCol(lastVal) {
                    return concatCol(next);
                });
            }, q() );
            
            
        })

        /*!
         * crop screenshot regarding page size
         */
        .then(function cropShot() {
            // console.log('In crop screenshot');

            var deferred = q.defer();

            var val = pageInfo;
            var w = val.documentWidth;
            var h = val.documentHeight;

            gm(fileName)
                .crop(w, h, 0, 0)
                .write(fileName, deferred.resolve);

            return deferred.promise;
        })

        /*!
         * remove tmp dir
         */
        .then(function rmTmpDir() {
            // console.log('In remove tmp dir');
            var deferred = q.defer();
            rimraf(tmpDir, deferred.resolve);
            return deferred.promise;
        })

        /*!
         * scroll back to start position
         */
        .then(function scrollToTop() {
            // console.log('In scroll back to start');
            return client.execute(scrollFn, 0, 0);
        });

};
