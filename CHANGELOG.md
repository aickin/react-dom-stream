## v0.5.0

### Improved performance

I found a few perf tweaks that make my TTLB benchmarks run as fast in `react-dom-stream` as they do in `react-dom`.

### Added Code Of Conduct

I realized I'd forgotten to explicitly add a code of conduct. Shame on me!

### Component Caching

I added an experimental feature, component caching, which allows the user to cache component renderings to be shared amongst different calls to `renderToString` and `renderToStaticMarkup`. This has the potential to massively speed up rendering when a server tends to continually generate the same markup snippets, but it can be very dangerous and leak private information if used incorrectly. Please do read the documentation for it in the README and try it out in development, but please DO NOT use in production until it has had more testing.

## v0.4.1

This was just an update to the README file.

## v0.4.0

This version changes the behavior of embedded streams when using `renderToStaticMarkup`. In v0.3.0, streams were sent directly to the output without escaping for the browser. However, I've come to believe this was the wrong decision, as it means that the default behavior is susceptible to cross-site scripting attacks. For this very reason, React automatically escapes Strings and provides `dangerouslySetInnerHTML` as a way for developers to get around the escaping.

In v0.4.0, any stream that is a child of an element will be browser-encoded, whereas added as the `dangerouslySetInnerHTML.__html` property will be added directly. So if you have the following code in v0.3.0:

```javascript
const stream = ReactDOMStream.renderToStaticMarkup(
	<div>
		{ReactDOMStream.renderToString(<span>Hello, World!</span>)}
	</div>
);
```

it will need to change to this in v0.4.0:

```javascript
const stream = ReactDOMStream.renderToStaticMarkup(
	<div dangerouslySetInnerHTML={{__html: ReactDOMStream.renderToString(<span>Hello, World!</span>)}} />
);
```

If you prefer the v0.3.0 child syntax to `dangerouslySetInnerHTML`, I made a library called `react-raw-html` which passes through children without encoding. So the v0.3.0 example above could also be rewritten in v0.4.0 as:

```javascript
import Raw from `react-raw-html`

const stream = ReactDOMStream.renderToStaticMarkup(
	<Raw.div>
		{ReactDOMStream.renderToString(<span>Hello, World!</span>)}
	</Raw.div>
);
```


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
