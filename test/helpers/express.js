var express = require('express');
var app = express();
app.use(express.static('test/site'));
var runningExpress = app.listen(3000);