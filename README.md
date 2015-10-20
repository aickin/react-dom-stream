# react-dom-stream

This is a React renderer for generating markup on a NodeJS server, but unlike the built-in `ReactDOM.renderToString`, this module renders to a stream.

## Why?

One difficulty with `ReactDOM.renderToString` is that it is synchronous, and it can become a performance challenge in server-side rendering of React sites. This is especially true of pages with larger HTML payloads, because `ReactDOM.renderToString`'s runtime tends to scale more or less linearly with the number of virtual DOM nodes. This leads to three problems:

1) The server cannot send out any part of the response until all the HTML is created, which means that browsers can't start working on painting the page until the renderToString call is done. With larger pages, this can introduce a latency of hundreds of milliseconds.
2) The server has to allocate memory for the entire HTML string.
3) One call to `ReactDOM.renderToString` can dominate the CPU and starve out other requests. This is particularly troublesome on servers that serve a mix of small and large pages.


This project attempts to fix the first two problems by rendering directly to a stream, and I hope to work on the third problem as the project develops.

When web servers stream out their content, browsers can render pages for users before the entire response is finished. To learn more about streaming HTML to browsers, see [HTTP Archive: adding flush](http://www.stevesouders.com/blog/2013/01/31/http-archive-adding-flush/) and [Flushing the Document Early](http://www.stevesouders.com/blog/2009/05/18/flushing-the-document-early/).

My preliminary tests have found that this renderer keeps the TTFB nearly constant as the size of a page gets larger. TTLB can be slightly longer than React's methods (~3%) when testing with zero network latency, but TTLB is as much as 47% less than React when real network speeds are used. In a real world test on Heroku, for example, I found that compared to React TTFB was 65% less and TTLB was 37% less for a 108KB page.

## How?

There are three public methods in this project: `renderToString`, `renderToStaticMarkup`, and `render`, and they are intended as nearly drop-in replacements for the corresponding methods in `react-dom`.

### `renderToString(reactElement, stream, options) : Promise(hash)`

To use this method, you need to require `react-dom-stream/server`.

This method renders `reactElement` to `stream`. The Promise that it returns resolves when the method is done writing to the stream, and the Promise resolves to a hash that must be passed to `react-dom-stream`'s `render` on the client side (see below.)

In an Express app, it is used like this:

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

Or, if you are using async/await from ES7, you can use it like this:

```javascript
import ReactDOMStream from "react-dom-stream/server";

app.get('/', async function (req, res) {
	var hash = await ReactDOMStream.renderToString(<Foo prop={value}/>, res);
	// TODO: write the hash out to the page in a script tag
	res.end();
});
```

`options` is currently ignored, but I have plans to add it soon.

### `renderToStaticMarkup(reactElement, stream, options): Promise()`

To use this method, you need to require `react-dom-stream/server`.

This method renders `reactElement` to `stream`. Like `ReactDOM.renderToStaticMarkup`, it is only good for static pages where you don't intend to use React to render on the client side, and it generates smaller sized markup than `reactToStringStream`. The Promise that it returns resolves when the method is done writing to the stream.

In an Express app, it is used like this:

```javascript
var ReactDOMStream = require("react-dom-stream/server");

app.get('/', function (req, res) {
	ReactDOMStream.renderToStaticMarkup(<Foo prop={value}/>, res)
		.then(function() {
			res.end();
		});
});
```

Or, if you are using async/await from ES7, you can use it like this:

```javascript
import ReactDOMStream from "react-dom-stream/server";

app.get('/', async function (req, res) {
	await ReactDOMStream.renderToStaticMarkup(<Foo prop={value}/>, res);
	res.end();
});
```

`options` is currently ignored, but I have plans to add it soon.

### `render(reactElement, domElement, hash)`

To use this method, you need to require `react-dom-stream`.

If you generate server markup with this project, you cannot use the standard `ReactDOM.render`; you need to use the `render` method in `react-dom-stream`. The only difference between `react-dom`'s version and this one is that this also takes in the hash returned from `renderToString`:

```javascript
var ReactDOMStream = require("react-dom-stream");

var hash = 1234567890; // returned from renderToString's promise and read out into the page
ReactDOMStream.render(<Foo prop={value}/>, document.getElementById("bar"), hash);
```

## Who?

`react-dom-stream` is written by Sasha Aickin, though most of the code is from Facebook's React.

## Status

This project is of alpha quality; it has not been used in production yet. It does, however, pass all of the automated tests that are currently run on `react-dom` in the main React project.

This module is forked from Facebook's React project. All extra code and modifications are offered under the Apache 2.0 license.