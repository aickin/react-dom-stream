# react-dom-stream

This is a React renderer for generating markup on a NodeJS server, but unlike the built-in `ReactDOM.renderToString`, this module renders to a stream. Streams make this library as much as 47% faster in sending down a full page than `ReactDOM.renderToString`, and user perceived performance gains can be even greater.

## Why?

One difficulty with `ReactDOM.renderToString` is that it is synchronous, and it can become a performance challenge in server-side rendering of React sites. This is especially true of pages with larger HTML payloads, because `ReactDOM.renderToString`'s runtime tends to scale more or less linearly with the number of virtual DOM nodes. This leads to three problems:

1. The server cannot send out any part of the response until all the HTML is created, which means that browsers can't start working on painting the page until the renderToString call is done. With larger pages, this can introduce a latency of hundreds of milliseconds.
2. The server has to allocate memory for the entire HTML string.
3. One call to `ReactDOM.renderToString` can dominate the CPU and starve out other requests. This is particularly troublesome on servers that serve a mix of small and large pages.


This project attempts to fix the first two problems by rendering directly to a stream, and I hope to work on the third problem as the project develops.

When web servers stream out their content, browsers can render pages for users before the entire response is finished. To learn more about streaming HTML to browsers, see [HTTP Archive: adding flush](http://www.stevesouders.com/blog/2013/01/31/http-archive-adding-flush/) and [Flushing the Document Early](http://www.stevesouders.com/blog/2009/05/18/flushing-the-document-early/).

My preliminary tests have found that this renderer keeps the TTFB nearly constant as the size of a page gets larger. TTLB can be slightly longer than React's methods (~3%) when testing with zero network latency, but TTLB is as much as 47% less than React when real network speeds are used. In a real world test on Heroku, for example, I found that compared to React TTFB was 65% less and TTLB was 37% less for a 108KB page. To see more on performance, check out the [react-dom-stream-example](https://github.com/aickin/react-dom-stream-example) repo.

## How?

First, install `react-dom-stream` into your project:

```
npm install --save react-dom-stream react-dom react
```

There are three public methods in this project: `renderToString`, `renderToStaticMarkup`, and `render`, and they are intended as nearly drop-in replacements for the corresponding methods in `react-dom`. 

### Rendering on the server

To use either of the server-side methods, you need to require `react-dom-stream/server`.

#### `Promise(Number) renderToString(ReactElement element, Stream stream, [Object options])`

This method renders `element` to `stream`. The Promise that it returns resolves when the method is done writing to the stream, and the Promise resolves to a hash that must be passed to `react-dom-stream`'s `render` on the client side (see below.)

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

`options` is an optional object with tunable options for rendering. Right now, it only supports `bufferSize`, which is a number of bytes to buffer before writing to the stream. It defaults to 10,000, although I reserve the right to change the default as we learn more about the performance of this library.

```javascript
// override the buffer to be just 1000 bytes.
var hash = await ReactDOMStream.renderToString(<Foo prop={value}/>, res, {bufferSize: 1000});
```

You may ask yourself: why go to the trouble of including a buffer, when the whole point of this project is to stream? Well, a naive implementation of React server streaming involves a lot of very small writes: every open tag, close tag, and tag content becomes a separate write. Preliminary performance tests indicate that streaming lots of small (<100B) writes to the output buffer can create enough overhead to overwhelm any performance gains from streaming. This is especially true when looking at TTLB. Coalescing writes into a limited, several kilobyte buffer adds a very small amount to TTFB, but in exchange TTLB comes way, way down.

#### `Promise renderToStaticMarkup(ReactElement element, Stream stream, [Object options])`

This method renders `element` to `stream`. Like `ReactDOM.renderToStaticMarkup`, it is only good for static pages where you don't intend to use React to render on the client side, and in exchange it generates smaller sized markup than `renderToString`. The Promise that it returns resolves when the method is done writing to the stream.

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

`options` is an optional object, and has one member, `bufferSize`. See `renderToString` above for more info.

### Rendering on the client

To use the client-side method, you need to require `react-dom-stream`.

#### `ReactComponent render(ReactElement element, DOMElement container, Number hash, [function callback])`

If you generate server markup with this project, *you cannot use the standard `ReactDOM.render`*; you *must* use the `render` method in `react-dom-stream`. The only difference between `react-dom`'s version and this one is that this `render` also takes in the hash returned from `renderToString`:

```javascript
var ReactDOMStream = require("react-dom-stream");

var hash = 1234567890; // returned from renderToString's promise and read out into the page
ReactDOMStream.render(<Foo prop={value}/>, document.getElementById("bar"), hash);
```

All other client-side methods on `react` and `react-dom` (like `createElement` or `unmountComponentAtNode`) can be used in concert with this `render` method.

## Who?

`react-dom-stream` is written by Sasha Aickin ([@xander76](https://twitter.com/xander76)), though let's be real, most of the code is forked from Facebook's React.

## Status

This project is of alpha quality; it has not been used in production yet. It does, however, pass all of the automated tests that are currently run on `react-dom` in the main React project.

This module is forked from Facebook's React project. All extra code and modifications are offered under the Apache 2.0 license.

## Something's wrong!

Please feel free to file any issues at <https://github.com/aickin/react-dom-stream>. Thanks!

## Wait, where's the code?

Well, this is awkward. You may have noticed that none of the actual server-side rendering code is actually not in the `react-dom-stream` repo. Most of the interesting code is over at <https://github.com/aickin/react/tree/streaming-render-0.14>, which is a fork of React. Specifically, check out [this commit](https://github.com/aickin/react/commit/d650a52e806f110ebec971e048b1dbded53cacd6) to see most of the interesting changes from React 0.14. Eventually, I hope to unify these repos, but for now, I just build the react fork repo and copy the resulting build/packages/reactlib/ directory over to this project before publishing to npm. 

## I'd like to contribute!

Awesome. You are the coolest.

If you'd like to send PRs to either repo, please feel free! I'll require a CLA before pulling code to keep rights clean, but we can figure that out when we get there.
