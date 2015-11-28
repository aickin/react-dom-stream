## v0.3.0

This version added the ability to embed streams as children in the React element tree when using `renderToStaticMarkup`. 

In v0.3.0, I also removed the v0.1.x API. If you need to convert your code, please see below how to do so.

## v0.2.0

This version's main achievement is changing the API to be more stream-friendly. The 0.1.x API is still supported, but it is deprecated and will cause a console error. In version 0.3.0, I will remove support for the 0.1.x API.

### Converting code from the v0.1.x API to the v0.2.x API

The first difference between v0.1.x's API and v0.2.x's API is how they handle the stream. v0.1.x accepted a Writable stream as an argument to `renderToString` and `renderToStaticMarkup`, but v0.2.x instead returns a Readable stream.

The second difference is that there is no longer a hash that is returned from `renderToString` and has to be read into the page.

The third difference is that you no longer need to use `react-dom-stream` to perform the client-side render. Using vanilla `ReactDOM.render` will work just fine.

So, if your `renderToString` code looks like this in v0.1.x:

```javascript
var ReactDOMStream = require("react-dom-stream/server");

app.get('/', function (req, res) {
	// SNIP: write out HTML before the React-rendered piece
	ReactDOMStream.renderToString(<Foo prop={value}/>, res)
		.then(function(hash) {
			// SNIP: write the hash out to the page in a script tag
			// SNIP: write out more HTML after the React-rendered piece.
			res.end();
		});
});
```

Then it should look like this in v0.2.x:

```javascript
var ReactDOMStream = require("react-dom-stream/server");

app.get('/', function (req, res) {
	// SNIP: write out HTML before the React-rendered piece
	var stream = ReactDOMStream.renderToString(<Foo prop={value}/>);
	stream.pipe(res, {end: false});
	stream.on("end", function() {
		// SNIP: write out more HTML after the React-rendered piece.
		res.end();
	});
});
```

Or, if you are using `renderToStaticMarkup`, and it looked like this in v0.1.x:

```javascript
var ReactDOMStream = require("react-dom-stream/server");

app.get('/', function (req, res) {
	ReactDOMStream.renderToStaticMarkup(<Foo prop={value}/>, res)
		.then(function() {
			res.end();
		});
});
```

It should look like this in v0.2.x:

```javascript
var ReactDOMStream = require("react-dom-stream/server");

app.get('/', function (req, res) {
	ReactDOMStream.renderToStaticMarkup(<Foo prop={value}/>).pipe(res);
});
```
