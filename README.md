# react-dom-stream

This is a React renderer for generating markup on a NodeJS server, but unlike the built-in `ReactDOM.renderToString`, this module renders to a stream. Streams make this library as much faster in sending down the first byte of a page than `ReactDOM.renderToString`, and user perceived performance gains can be significant.

## Why?

One difficulty with `ReactDOM.renderToString` is that it is synchronous, and it can become a performance bottleneck in server-side rendering of React sites. This is especially true of pages with larger HTML payloads, because `ReactDOM.renderToString`'s runtime tends to scale more or less linearly with the number of virtual DOM nodes. This leads to three problems:

1. The server cannot send out any part of the response until the entire HTML is created, which means that browsers can't start working on painting the page until the renderToString call is finished. With larger pages, this can introduce a latency of hundreds of milliseconds.
2. The server has to allocate memory for the entire HTML string.
3. One call to `ReactDOM.renderToString` can dominate the CPU and starve out other requests. This is particularly troublesome on servers that serve a mix of small and large pages.


This project attempts to fix these three problems by rendering asynchronously to a stream.

When web servers stream out their content, browsers can render pages for users before the entire response is finished. To learn more about streaming HTML to browsers, see [HTTP Archive: adding flush](http://www.stevesouders.com/blog/2013/01/31/http-archive-adding-flush/) and [Flushing the Document Early](http://www.stevesouders.com/blog/2009/05/18/flushing-the-document-early/).

My preliminary tests have found that this renderer keeps the TTFB nearly constant as the size of a page gets larger. TTLB can be  longer than React's methods (by about 15-20%) when testing with zero network latency, but TTLB is often lower than React when real network speed and latency is used. For example, in a real world test against Heroku with a 628KB page, TTFB was 55% faster and TTLB was 8% faster. To see more on performance, check out the [react-dom-stream-example](https://github.com/aickin/react-dom-stream-example) repo.

## How?

First, install `react-dom-stream` into your project:

```
npm install --save react-dom-stream react-dom react
```

There are two public methods in this project: `renderToString`, `renderToStaticMarkup`, and they are intended as nearly drop-in replacements for the corresponding methods in `react-dom/server`.

### Rendering on the server

To use either of the server-side methods, you need to require `react-dom-stream/server`.

#### `Readable renderToString(ReactElement element)`

This method renders `element` to a readable stream that is returned from the method. In an Express app, it is used like this (all examples are in ES2015):

```javascript
import ReactDOMStream from "react-dom-stream/server";

app.get('/', (req, res) => {
	// TODO: write out the html, head, and body tags
	var stream = ReactDOMStream.renderToString(<Foo prop={value}/>);
	stream.pipe(res, {end: false});
	stream.on("end", function() {
		// TODO: write out the rest of the page, including the closing body and html tags.
		res.end();
	});
});
```

Or, if you'd like a more terse (but IMO slightly harder to understand) version:

```javascript
import ReactDOMStream from "react-dom-stream/server";

app.get('/', (req, res) => {
	// TODO: write out the html, head, and body tags
	ReactDOMStream.renderToString(<Foo prop={value}/>).on("end", () =>{
		// TODO: write out the rest of the page, including the closing body and html tags.
		res.end();
	}).pipe(res, {end:false});
});
```

If the piping syntax is not to your liking, check out the section below on combining `renderToString` and `renderToStaticMarkup` to render a full page.

#### `Readable renderToStaticMarkup(ReactElement element)`

This method renders `element` to a readable stream that is returned from the method. Like `ReactDOM.renderToStaticMarkup`, it is only good for static pages where you don't intend to use React to render on the client side, and in exchange it generates smaller sized markup than `renderToString`.

In an Express app, it is used like this:

```javascript
import ReactDOMStream from "react-dom-stream/server";

app.get('/', (req, res) => {
	ReactDOMStream.renderToStaticMarkup(<Foo prop={value}/>).pipe(res);
});
```

As of v0.3.x, `renderToStaticMarkup` can also accept streams as children in the React element tree; see the next section for how this can be used to render a full page.

### Combining `renderToStaticMarkup` and `renderToString` to serve a page

If you have used React for server and client rendering before, you probably know that React does not work on the client side if you try to render the entire HTML markup or [even if you try to render just the HTML body](https://medium.com/@dan_abramov/two-weird-tricks-that-fix-react-7cf9bbdef375#.7tqgmc4pj). As a result, with vanilla `react-dom/server` many developers use `renderToStaticMarkup` to generate the `<html>`, `<head>`, and `<body>` tags, and then embed the output of `renderToString` into a div inside the body.

I wanted this pattern to be possible in `react-dom-stream`, so `renderToStaticMarkup` accepts Readable streams as children in the React element tree the same way that it accepts Strings as children in the tree. This is useful for using `renderToStaticMarkup` for the page template and `renderToString` for the dynamic HTML that you want to render with React on the client. Note that, as with Strings, `react-dom-stream` automatically encodes streams to protect against cross-site scripting attacks, so you need to use `dangerouslySetInnerHTML` to embed markup. That would look something like this:

```javascript
import ReactDOMStream from "react-dom-stream/server";

app.get("/", (req, res) => {
	// use renderToStaticMarkup to generate the entire HTML markup, embedding the
	// dynamic part under the renderDiv div.
	ReactDOMStream.renderToStaticMarkup(
		<html>
			<head>
				<script src="myscript.js"></script>
				<title>My Cool Page</title>
			</head>
			<body>
				<div id="renderDiv" dangerouslySetInnerHTML={{__html: ReactDOMStream.renderToString(<Foo prop={value}/>)}}></div>
				<script>
					{`  // custom javascript for reconnecting on the client side.
						ReactDOM.render(<Foo prop={${value}}/>, document.getElementById("renderDiv"));`}
				</script>
			</body>
		</html>
	).pipe(res);
});
```

If you don't like using `dangerouslySetInnerHTML`, consider using my companion project `react-raw-html`, which doesn't encode children that are Strings or Streams. The previous example would then look like this:

```javascript
import ReactDOMStream from "react-dom-stream/server";
import Raw from "react-raw-html";

app.get("/", (req, res) => {
	// use renderToStaticMarkup to generate the entire HTML markup, embedding the
	// dynamic part under the renderDiv div.
	ReactDOMStream.renderToStaticMarkup(
		<html>
			<head>
				<script src="myscript.js"></script>
				<title>My Cool Page</title>
			</head>
			<body>
				<Raw.div id="renderDiv">
					{ReactDOMStream.renderToString(<Foo prop={value}/>)}
				</Raw.div>
				<script>
					{`  // custom javascript for reconnecting on the client side.
						ReactDOM.render(<Foo prop={${value}}/>, document.getElementById("renderDiv"));`}
				</script>
			</body>
		</html>
	).pipe(res);
});
```

Note that `renderToString` does **not** accept streams as children in the React element tree, as there would be no way to reconnect to that markup on the client side. If you want to embed a stream on the server side, you want to use `renderToStaticMarkup`.

### Reconnecting the markup on the client

In previous versions of `react-dom-stream`, you needed to use a special render library to reconnect to server-generated markup. As of version 0.2.0 and later, this is no longer the case. You can now use the normal `ReactDOM.render` method, as you would when using `ReactDOM` to generate server-side markup.

## When should you use `react-dom-stream`?

Currently, `react-dom-stream` offers a tradeoff: for larger pages, it significantly reduces time to first byte while somewhat increasing time to last byte.

For smaller pages, `react-dom-stream` can actually be a net negative, albeit a small one. String construction in Node is extremely fast, and streams and asynchronicity add an overhead. In my testing, pages smaller than about 50KB have worse TTFB and TTLB using `react-dom-stream`. These pages are not generally a performance bottleneck to begin with, though, and on my mid-2014 2.8GHz MBP, the difference in render time between `react-dom` and `react-dom-stream` is usually less than a millisecond.

For larger pages, the TTFB stays relatively constant as the page gets larger (TTFB hovers around 4ms on my laptop), while the TTLB tends to hover around 15-20% longer than `react-dom`. Using this project gets you faster user perceived performance at the cost of worse TTLB performance. However, even here, there is a wrinkle, because most of my testing has been done against localhost. When real world network speeds and latencies are used, `react-dom-stream` often beats React in both TTFB and TTLB. This is probably because `react-dom-stream` faster time to first byte gets a headstart on filling up the network pipe.

One other operational challenge that `react-dom-stream` can help with is introducing asynchronicity, which can allow requests for small pages to not get completely blocked by executing requests for large pages.

I will try in later releases to reduce the extra overhead in `react-dom-stream` in order to make it less of a tradeoff, although it remains to be seen if that can be achieved.

## Who?

`react-dom-stream` is written by Sasha Aickin ([@xander76](https://twitter.com/xander76)), though let's be real, about 99% of the code is forked from Facebook's React.

## Status

This project is of beta quality; I don't know if it has been used in production yet, and the API is firming up. It does, however, pass all of the automated tests that are currently run on `react-dom` in the main React project plus one or two dozen more that I've written.

This module is forked from Facebook's React project. All extra code and modifications are offered under the Apache 2.0 license.

## Something's wrong!

Please feel free to file any issues at <https://github.com/aickin/react-dom-stream>. Thanks!

## Upgrading from v1.x

There was a major change to the API from version 0.1.x to version 0.2.x, as a result of the discussion in issue #2. The version 0.1.x API still works in v0.2.x, but it was removed in v0.3.x. To learn more about how to upgrade your client code, please read [CHANGELOG.md](/CHANGELOG.md).

## Upgrading from v3.x

There was a breaking change from 3.x to 4.x, which is that the 4.x `renderToStaticMarkup` now automatically escapes the characters of a child stream, whereas 3.x did not. To learn about how to upgrade your client code, please read [CHANGELOG.md](/CHANGELOG.md).

## Wait, where's the code?

Well, this is awkward.

You may have noticed that all of the server-side rendering code is in a directory called `lib` and `dist`, which is not checked in to the `react-dom-stream` repo. That's because most of the interesting code is over at <https://github.com/aickin/react/tree/streaming-render-0.2>, which is a fork of React. Specifically, check out [this commit](https://github.com/aickin/react/commit/9159656c53c0335ec6bd56fc7537231a9abeb5d5) to see most of the interesting changes from React 0.14.


## I'd like to contribute!

Awesome. You are the coolest.

To get a working build running and learn a little about how the project is set up, please read [CONTRIBUTING.md](CONTRIBUTING.md).

If you'd like to send PRs to either repo, please feel free! I'll require a CLA before pulling code to keep rights clean, but we can figure that out when we get there.

Please note that this project adheres to the [Open Code of Conduct][code-of-conduct]. By participating, you are expected to honor this code.
[code-of-conduct]: http://todogroup.org/opencodeofconduct/#react-dom-stream/xander76@yahoo.com
