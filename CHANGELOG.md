## v0.2.0

This version's main achievement is changing the API to be more stream-friendly. The 0.1.x API is still supported, but it is deprecated and will cause a console error. In version 0.3.0, I will remove support for the 0.1.x API.

### Converting code from the v0.1.x API to the v0.2.x API

The first difference between v0.1.x's API and v0.2.x's API is how they handle the stream. v0.1.x accepted a Writable stream as an argument to `renderToString` and `renderToStaticMarkup`, but v0.2.x instead returns a Readable stream.

The second difference is that the hash Promise returned from `renderToString` is now a property called `hash` on the stream that is the return value.

The third difference is that there is no longer an `options` argument for either server-side render method, and the methods no longer buffer their output. Buffering is still vital to getting good performance, but you can (and should!) use projects like `compression` or `buffered-stream`. For more information, see the buffering section of the readme.

If your `renderToString` code looks like this in v0.1.x:

```javascript
var ReactDOMStream = require("react-dom-stream/server");

app.get('/', function (req, res) {
	ReactDOMStream.renderToString(<Foo prop={value}/>, res)
		.then(function(hash) {
			// TODO: write the hash out to the page in a script tag
			res.end();
		});
});
```

Then it should look like this in v0.2.x:

```javascript
var ReactDOMStream = require("react-dom-stream/server");

app.get('/', function (req, res) {
	var stream = ReactDOMStream.renderToString(<Foo prop={value}/>);
	stream.pipe(res, {end: false});
	stream.hash.then(function(hash) {
		// TODO: write the hash out to the page in a script tag
		res.end();
	});
});
```

Since `renderToStaticMarkup returns a stream without a hash parameter, its code is much simpler. The following v0.1.x code:

```javascript
var ReactDOMStream = require("react-dom-stream/server");

app.get('/', function (req, res) {
	ReactDOMStream.renderToStaticMarkup(<Foo prop={value}/>, res)
		.then(function() {
			res.end();
		});
});
```

looks like this in v0.2.x:

```javascript
var ReactDOMStream = require("react-dom-stream/server");

app.get('/', function (req, res) {
	ReactDOMStream.renderToStaticMarkup(<Foo prop={value}/>).pipe(res);
});
```


