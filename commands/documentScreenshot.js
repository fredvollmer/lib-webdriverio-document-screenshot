'use strict';
/* jshint node: true */
/* global document,window,navigator */

/**
 *
 * Save a screenshot as a base64 encoded image with the current state of the browser.
 *
 * <example>
    :documentScreenshot.js
    client
        .windowHandleSize({width: 500, height: 500})
        .documentScreenshot('wholeScreen.png', {shotDelay: 200})
        .end();
 * </example>
 *
 * @param {String}   fileName   path of generated image (relative to the execution directory)
 * @param {Object}   options    optional settings
 * @param {Object}   options.shotDelay    time in ms to wait before taking screenshots (default: 100)
 *
 * @uses protocol/execute, protocol/screenshot, protocol/pause
 * @type utility
 *
 */

var path = require('path');
var fs = require('fs-extra');
var gm = require('gm');
var q = require('q');

var generateUUID = require('../utils/generateUUID.js');

module.exports = function documentScreenshot(fileName, options) {
    var client = this;
    options = options || {};

    /*!
     * parameter check
     */
    var ErrorHandler = client.ErrorHandler;
    if (typeof fileName !== 'string') {
        throw new ErrorHandler.CommandError(
            'typeof required "fileName" parameter is "' + (typeof fileName) + '". Should be "string"'
        );
    }
    if (options.shotDelay && typeof options.shotDelay !== 'number') {
        throw new ErrorHandler.CommandError(
            'typeof optional "shotDelay" option is "' + (typeof options.shotDelay) + '". Should be "number".'
        );
    }
    if (options.shouldScroll && typeof options.shouldScroll !== 'boolean') {
        throw new ErrorHandler.CommandError(
            'typeof optional "shouldScroll" option is "' + (typeof options.shouldScroll) + '". Should be "boolean".'
        );
    }

    // options
    var shouldScroll = true;
    if (options.shouldScroll === false) {
        shouldScroll = false;
    }
    // var shouldScroll = options.shouldScroll || true;
    var shotDelay = options.shotDelay || 100;

    // Vars shared across async calls
    var pageInfo = null;
    var tmpDir = null;
    var cropImages = [];
    var x = 0;
    var y = 0;

    var scrollFn = function scrollFn(w, h, shouldClientScroll) {
        /**
         * IE8 or older
         */
        if (document.all && !document.addEventListener) {
            /**
             * this still might not work
             * seems that IE8 scroll back to 0,0 before taking screenshots
             */
            document.body.style.marginTop = '-' + h + 'px';
            document.body.style.marginLeft = '-' + w + 'px';
            return;
        }

        if (shouldClientScroll === true) {
            document.body.style.webkitTransform = 'translate(-' + w + 'px, -' + h + 'px)';
            document.body.style.mozTransform = 'translate(-' + w + 'px, -' + h + 'px)';
            document.body.style.msTransform = 'translate(-' + w + 'px, -' + h + 'px)';
            document.body.style.oTransform = 'translate(-' + w + 'px, -' + h + 'px)';
            document.body.style.transform = 'translate(-' + w + 'px, -' + h + 'px)';
        }
    };

    // Return a promise
    return q()

        /*!
         * create tmp directory to cache viewport shots
         */
        .then(function makeTmpDir() {
            var deferred = q.defer();

            var uuid = generateUUID();
            tmpDir = path.join(__dirname, '..', '.tmp-' + uuid);

            fs.mkdirs(tmpDir, '0755', deferred.resolve);

            return deferred.promise;
        })

        /*!
         * prepare page scan
         */
        .then(function prepPageScan() {
            // console.log('In prep page scan');
            return client.execute(function getPageInfo(shouldClientScroll) {
                /**
                 * remove scrollbars
                 */
                document.body.style.overflow = 'hidden';

                if (navigator.userAgent.indexOf('Chrome') > -1) {
                    document.styleSheets[0].insertRule('::-webkit-scrollbar {width: 0px;}', 0);
                }
                // reset height in case we're changing viewports
                if (shouldClientScroll === true) {
                    document.body.style.height = 'auto';
                    document.body.style.height = document.documentElement.scrollHeight + 'px';
                    /**
                     * scroll back to start scanning
                     */
                    window.scrollTo(0, 0);
                }

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
            }, shouldScroll).then(function storePageInfo(res) { pageInfo = res.value; });
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
                deferred.resolve(client.screenshot.bind(client)());

                var promise = deferred.promise;

                return promise

                    .then(function cacheImage(res) {
                        // console.log('cacheImage || In');

                        var deferred = q.defer();

                        var tmpFileName = tmpDir + '/' + x + '-' + y + '.png';
                        var image = gm(new Buffer(res.value, 'base64'));

                        if (pageInfo.devicePixelRatio > 1) {
                            var percent = 100 / pageInfo.devicePixelRatio;
                            image.resize(percent, percent, '%');
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
                            .execute(scrollFn, x * pageInfo.screenWidth, y * pageInfo.screenHeight, shouldScroll)
                            .pause(shotDelay);
                    });
            };

            // Start 'while loop' or just take 1 shot
            return shouldScroll ? repeater(checkPos, loop) : loop();
        })

        /*!
         * ensure that filename exists
         */
        .then(function ensureDestinationFile() {
            // console.log('ensureDestinationFile || In');
            var dir = fileName.replace(/[^/ \\]*\.(png|jpe?g|gif|tiff?)$/, '');
            return fs.mkdirsSync(dir);
        })

        /*!
         * concats all shots
         */
        .then(function concatAllShots() {
            // console.log('concatAllShots || In');
            var subImg = 0;

            var screenshot = null;

            var concatCol = function concatCol(verticalShotArray) {
                var deferred = q.defer();

                // Convert array of filenames to a gm image
                var col = gm(verticalShotArray.shift());
                col.append.apply(col, verticalShotArray);

                if (!screenshot) {
                    // First screenshot
                    screenshot = col;
                    col.write(fileName, function (err) {
                        if (err) {
                            deferred.reject(err);
                        }
                        deferred.resolve();
                    });
                } else {
                    // Previous columns saved. Concat col to existing image.
                    var subImgPath = tmpDir + '/' + (++subImg) + '.png';
                    col.write(subImgPath, function handleWriteCol() {
                        gm(fileName)
                            .append(subImgPath, true)
                            .write(fileName, function (err) {
                                if (err) {
                                    deferred.reject(err);
                                }
                                deferred.resolve();
                            });
                    });
                }
                return deferred.promise;
            };

            return cropImages.reduce(function columnsToPromiseChain(last, next) {
                return last.then(function concatNextCol(lastVal) {
                    return concatCol(next);
                });
            }, q());
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
            fs.remove(tmpDir, deferred.resolve);
            return deferred.promise;
        })

        /*!
         * scroll back to start position
         */
        .then(function scrollToTop() {
            if (shouldScroll === true) {
                // console.log('In scroll back to start');
                return client.execute(scrollFn, 0, 0, shouldScroll);
            }
        });
};
