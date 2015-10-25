# react-dom-stream

This is a React renderer for generating markup on a NodeJS server, but unlike the built-in `ReactDOM.renderToString`, this module renders to a stream. Streams make this library as much as 47% faster in sending down a full page than `ReactDOM.renderToString`, and user perceived performance gains can be even greater.

## Why?

One difficulty with `ReactDOM.renderToString` is that it is synchronous, and it can become a performance bottleneck in server-side rendering of React sites. This is especially true of pages with larger HTML payloads, because `ReactDOM.renderToString`'s runtime tends to scale more or less linearly with the number of virtual DOM nodes. This leads to three problems:

1. The server cannot send out any part of the response until the entire HTML is created, which means that browsers can't start working on painting the page until the renderToString call is finished. With larger pages, this can introduce a latency of hundreds of milliseconds.
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

#### `HashedReadable renderToString(ReactElement element)`

This method renders `element` to a readable stream that is returned from the method. The returned stream is a "HashedReadable", which is just a Readable stream with an extra property, `hash`.  `hash` is a Promise which resolves to a hash that must be passed to `react-dom-stream`'s `render` on the client side (see below for info on client rendering). 

In an Express app, it is used like this:

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

Or, if you are using async/await from ES7, you can use it like this:

```javascript
import ReactDOMStream from "react-dom-stream/server";

app.get('/', async function (req, res) {
	const stream = ReactDOMStream.renderToString(<Foo prop={value}/>);
	stream.pipe(res, {end:false});
	const hash = await stream.hash;
	// TODO: write the hash out to the page in a script tag
	res.end();
});
```

#### `Readable renderToStaticMarkup(ReactElement element)`

This method renders `element` to a readable stream that is returned from the method. Like `ReactDOM.renderToStaticMarkup`, it is only good for static pages where you don't intend to use React to render on the client side, and in exchange it generates smaller sized markup than `renderToString`.

In an Express app, it is used like this:

```javascript
var ReactDOMStream = require("react-dom-stream/server");

app.get('/', function (req, res) {
	ReactDOMStream.renderToStaticMarkup(<Foo prop={value}/>).pipe(res);
});
```

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

## Best practices for streaming

In the real world, streaming performance can be a little more complicated than just dropping in `react-dom-stream`, and I'm running tests to determine what a good generic recommendation should be for users of this library. 

However, one thing has become completely clear even in minimal testing: *some amount of buffering is mandatory for good performance. *

You may ask yourself: why go to the trouble of including a buffer, when the whole point of this project is to stream a response? Well, a naive implementation of server streaming involves a lot of very small writes: every open tag, close tag, and tag content becomes a separate write to the output stream. Preliminary performance tests indicate that streaming lots of small (<100B) writes to the output buffer can easily create enough overhead to overwhelm any performance gains from streaming. This overhead from small writes is especially pronounced when looking at TTLB. 

My current recommendation is to coalesce writes into a several kilobyte buffer, via one of two ways:

1. (*Recommended*) Use the `compression` middleware to introduce gzip compression to your response. This kind of compression automatically adds some buffering to the response, because gzip requires the ability to see a bit of the response before compressing. `compression` defaults to a 16KB buffer, and it can be changed via the `chunkSize` parameter:
```javascript
var compression = require("compression");
// set the buffer size to 5 KB
app.use(compression({chunkSize:5 * 1024}));
ReactDOMStream.renderToStaticMarkup(<Foo prop={value}/>).pipe(res);
```
2. Use a project like `buffered-stream` to pipe the stream to the response. You pass a number of bytes to `buffered-stream` to determine the buffer size: 
```javascript
// set the buffer size to 5 KB
var buffered = require("buffered-stream");
var buffer = buffered(5*1024);
ReactDOMStream.renderToStaticMarkup(<Foo prop={value}/>).pipe(buffer).pipe(res);
```

Since gzip/deflate compression is a best practice for performance, I highly recommend option #1.

###  How big should the buffer be?

The short answer here is that it depends, and I'm doing some ongoing tests to figure out some good defaults. The larger the buffer, the larger the time to first byte, but the shorter the buffer, the larger the time to *last* byte. At very small buffer sizes (say, less than 100 bytes), time to last byte can end up being twice as long as not using streaming at all. 

For now, I'd recommend a buffer between 1-10KB, which I think will give a good trade off, sacrificing a few milliseconds in TTFB for a major reduction in TTLB. I'll continue to do tests to understand this better, and I welcome others to contribute their knowledge in pull requests or issues. 

## Who?

`react-dom-stream` is written by Sasha Aickin ([@xander76](https://twitter.com/xander76)), though let's be real, most of the code is forked from Facebook's React.

## Status

This project is of alpha quality; it has not been used in production yet, and the API is firming up. It does, however, pass all of the automated tests that are currently run on `react-dom` in the main React project.

This module is forked from Facebook's React project. All extra code and modifications are offered under the Apache 2.0 license.

## Something's wrong!

Please feel free to file any issues at <https://github.com/aickin/react-dom-stream>. Thanks!

## Upgrading from v1.x

There was a major change to the API from version 1.x to version 2.x, as a result of the discussion in issue #2. The version 1.x API still work in v2.x, but it will be removed in v3.x. To learn more about how to upgrade your client code, please read [CHANGELOG.md](/CHANGELOG.md). 

## Wait, where's the code?

Well, this is awkward. 

You may have noticed that all of the server-side rendering code is in a directory called `lib`, which is not checked in to the `react-dom-stream` repo. That's because most of the interesting code is over at <https://github.com/aickin/react/tree/streaming-render-0.14>, which is a fork of React. Specifically, check out [this commit](https://github.com/aickin/react/commit/d650a52e806f110ebec971e048b1dbded53cacd6) to see most of the interesting changes from React 0.14.


## I'd like to contribute!

Awesome. You are the coolest.

To get a working build running and learn a little about how the project is set up, please read [CONTRIBUTING.md](CONTRIBUTING.md). 

If you'd like to send PRs to either repo, please feel free! I'll require a CLA before pulling code to keep rights clean, but we can figure that out when we get there.
