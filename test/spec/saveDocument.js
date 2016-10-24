/* global browser, should, fs, gm */
var testURL = 'http://localhost:3000/index.html';
var testIndexImageScroll = 'test/reports/index_1024xY.png';
var fixtureIndexImageScroll = 'test/fixtures/index_1024xY.png';
describe('document screenshot scrolling', function () {
    it('should capture the document', function () {
        browser.url(testURL);
        browser.setViewportSize({
            width: 1024,
            height: 768
        });
        browser.documentScreenshot(testIndexImageScroll, {
            shotDelay: 500,
            shouldScroll: true,
        });
    });
    it('shoud produce an image file', function () {
        fs.exists(testIndexImageScroll, function (exists) {
            exists.should.be.equal(true);
        });
    });
    it('image should be the correct size', function () {
        gm(testIndexImageScroll).size(function (err, testSize) {
            testSize.height.should.be.equal(3206);
            testSize.width.should.be.equal(1024);
        });
    });
    it('should be equal to fixture image', function () {
        var options = {
            highlightColor: 'yellow',
            file: 'test/reports/index_1024xY.diff.png'
        };
        gm.compare(fixtureIndexImageScroll, testIndexImageScroll, options, function (err) {
            if (err) {
                throw err;
            }
        });
    });
});
