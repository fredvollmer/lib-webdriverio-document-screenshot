/* global browser, should, fs, gm */
var testURL = 'http://localhost:3000/index.html';
var testIndexImageViewport = 'test/reports/index_1024x768.png';
var fixtureIndexImageViewport = 'test/fixtures/index_1024x768.png';
describe('document screenshot capturing viewport', function () {
    it('should capture the document', function () {
        browser.url(testURL);
        browser.setViewportSize({
            width: 1024,
            height: 768
        });
        browser.documentScreenshot(testIndexImageViewport, {
            shotDelay: 500,
            shouldScroll: false,
        });
    });
    it('shoud produce an image file', function () {
        fs.exists(testIndexImageViewport, function (exists) {
            exists.should.be.equal(true);
        });
    });
    it('image should be the correct size', function () {
        gm(testIndexImageViewport).size(function (err, testSize) {
            testSize.height.should.be.equal(768);
            testSize.width.should.be.equal(1024);
        });
    });
    it('should equal to fixture image', function () {
        var options = {
            highlightColor: 'red',
            file: 'test/reports/index_1024x768.diff.png'
        };
        gm.compare(fixtureIndexImageViewport, testIndexImageViewport, options, function (err) {
            if (err) {
                throw err;
            }
        });
    });
});
