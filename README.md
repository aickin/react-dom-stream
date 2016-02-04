# react-dom-stream

This is a React renderer for generating markup on a NodeJS server, but unlike the built-in `ReactDOM.renderToString`, this module renders to a stream. Streams make this library much faster at sending down the page's first byte than `ReactDOM.renderToString`, and user perceived performance gains can be significant.

## Why?

One difficulty with `ReactDOM.renderToString` is that it is synchronous, and it can become a performance bottleneck in server-side rendering of React sites. This is especially true of pages with larger HTML payloads, because `ReactDOM.renderToString`'s runtime tends to scale more or less linearly with the number of virtual DOM nodes. This leads to three problems:

1. The server cannot send out any part of the response until the entire HTML is created, which means that browsers can't start working on painting the page until the renderToString call is finished. With larger pages, this can introduce a latency of hundreds of milliseconds.
2. The server has to allocate memory for the entire HTML string.
3. One call to `ReactDOM.renderToString` can dominate the CPU and starve out other requests. This is particularly troublesome on servers that serve a mix of small and large pages.


This project attempts to fix these three problems by rendering asynchronously to a stream.

When web servers stream out their content, browsers can render pages for users before the entire response is finished. To learn more about streaming HTML to browsers, see [HTTP Archive: adding flush](http://www.stevesouders.com/blog/2013/01/31/http-archive-adding-flush/) and [Flushing the Document Early](http://www.stevesouders.com/blog/2009/05/18/flushing-the-document-early/).

My preliminary tests have found that this renderer keeps the TTFB nearly constant as the size of a page gets larger. TTLB in my tests is almost identical to React's methods when testing with zero network latency, but TTLB can be significantly lower than React when real network speed and latency is used. To see more on performance, check out the [react-dom-stream-example](https://github.com/aickin/react-dom-stream-example) repo.

To learn more about ways to speed up your React server (including using `react-dom-stream`), check out my talk from the ReactJS SF meetup in January 2016:

<a href="http://www.youtube.com/watch?feature=player_embedded&v=PnpfGy7q96U"><img src="http://img.youtube.com/vi/PnpfGy7q96U/0.jpg" alt="YouTube: Speed Up Your React Server With These 6 Weird Tricks" width="240" height="180" border="10"></a>

## How?

First, install `react-dom-stream` into your project:

```
npm install --save react-dom-stream react-dom react
```

There are two public methods in this project: `renderToString`, `renderToStaticMarkup`, and they are intended as nearly drop-in replacements for the corresponding methods in `react-dom/server`.

### Rendering on the server

To use either of the server-side methods, you need to require `react-dom-stream/server`.

#### `ReadableStream renderToString(ReactElement element, [Object options])`

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

#### `ReadableStream renderToStaticMarkup(ReactElement element, [Object options])`

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

If you have used React for server and client rendering before, you probably know that React does not work on the client side if you try to render the entire HTML markup or [even if you try to render just the entire HTML body](https://medium.com/@dan_abramov/two-weird-tricks-that-fix-react-7cf9bbdef375#.7tqgmc4pj). As a result, with vanilla `react-dom/server` many developers use `renderToStaticMarkup` to generate the `<html>`, `<head>`, and `<body>` tags, and then embed the output of `renderToString` into a div inside the body.

I wanted this pattern to be possible in `react-dom-stream`, so `renderToStaticMarkup` accepts readable streams as children in the React element tree the same way that it accepts Strings as children in the tree. This is useful for using `renderToStaticMarkup` for the page template and `renderToString` for the dynamic HTML that you want to render with React on the client. Note that, as with Strings, `react-dom-stream` automatically HTML encodes streams to protect against cross-site scripting attacks, so you need to use `dangerouslySetInnerHTML` to embed markup. That would look something like this:

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

If you don't like using `dangerouslySetInnerHTML`, consider using my companion project [`react-raw-html`](https://github.com/aickin/react-raw-html), which doesn't encode children that are Strings or Streams. The previous example would then look like this:

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

### Experimental feature: Component Caching

In v0.5.x, I've added an experimental feature: component caching. This feature is based on the insight that a large amount of rendering time on a React server is wasted re-rendering components with the exact same props and state they had in the previous page render. If a component is a pure function of props & state, it should be possible to cache (or memoize) the render results and speed up rendering significantly.

To try this out in v0.5.x, you need to do two things. First, you must instantiate a cache object and pass it to either `renderToString` or `renderToStaticMarkup` as the `cache` attribute on the optional options argument. Currently, there is only one implementation of a cache, `LRURenderCache`, contained in the module `react-dom-stream/lru-render-cache`. It takes in an options object that has one attribute, `max`, which specifies the maximum number of characters in the cache. It looks like this:

```javascript
import ReactDOMStream from "react-dom-stream/server";
import LRURenderCache from "react-dom-stream/lru-render-cache";

// create a cache that stores 64MB of text.
const myCache = LRURenderCache({max: 64 * 1024 * 1024});

app.get('/', (req, res) => {
	ReactDOMStream.renderToStaticMarkup(<Foo prop={value}/>, {cache: myCache}).pipe(res);
});
```

Second, you need to have your components opt in to caching by implementing a method called `componentCacheKey`, which returns a single String representing a useable cache key for that component's current state. The String returned by `componentCacheKey` **must include all inputs to rendering** so that it can be used as a cache key for the render. If `componentCacheKey` leaves out some of the inputs to rendering, it's possible that you will get cache collisions, and you will serve up the wrong content to your users. Here's an example of a correct implementation:

```javascript
import React from "react"

export default class CacheableComponent extends React.Component {
	render() {
		return <span>Hello, ${this.props.name}!</span>;
	}

	componentCacheKey() {
		// the name prop completely specifies what the rendering will look like.
		return this.props.name;
	}
}
```

Here is an **incorrect** implementation:

```javascript
import React from "react"

export default class BADCacheableComponent extends React.Component {
	render() {
		return <span>Hello, ${this.props.name}! It is ${new Date()}</span>;
	}

	// INCORRECT!!
	componentCacheKey() {
		// the name prop does NOT completely specify the render,
		// so this implementation is WRONG.
		return this.props.name;
	}
}
```

In this example, the rendering depends on both `this.props.name` and `Date.now()`, but `componentCacheKey` only returns `this.props.name`. This means that subsequent renderings of the component with the same name will get a cache hit, and the time will therefore be out of date.

Note that this caching feature is powerful, but as of right now it is **extremely experimental**. I would be very pleased if folks try it out in development and give me feedback, but I strongly believe it **should not be used in production** until it has been tested more thoroughly. Server-side caching on a component basis has real potential, but mistakes in server-side caching can be extremely costly, as they are often liable to leak private information between users. You have been warned.

Also, note that the APIs of this feature are liable to change.

In the future, I hope to add features to caching such as:

* the ability to write a custom cache implementation.
* comprehensive statistics of cache efficiency (hit & miss rate, time spent looking up entries in the cache, total time saved/spent by the cache, etc.).
* a self-tuning cache that can decide whether or not to cache a component based on that component class's previous hit rate and/or the expense of generating its cache keys.

Feel free to file issues asking for features you would find interesting.

### Reconnecting the markup on the client

In previous versions of `react-dom-stream`, you needed to use a special render library to reconnect to server-generated markup. As of version 0.2.0 and later, this is no longer the case. You can now use the normal `ReactDOM.render` method, as you would when using `ReactDOM` to generate server-side markup.

## When should you use `react-dom-stream`?

Currently, `react-dom-stream` offers a slight tradeoff: for larger pages, it significantly reduces time to first byte while for smaller pages, `react-dom-stream` can actually be a net negative, albeit a small one. String construction in Node is extremely fast, and streams and asynchronicity add an overhead. In my testing, pages smaller than about 50KB have worse TTFB and TTLB using `react-dom-stream`. These pages are not generally a performance bottleneck to begin with, though, and on my mid-2014 2.8GHz MBP, the difference in render time between `react-dom` and `react-dom-stream` for these small pages is usually less than a millisecond.

For larger pages, the TTFB stays relatively constant as the page gets larger (TTFB stays around 4ms on my laptop), while the TTLB tends to hover at or slightly below the time that `react-dom` takes. However, even here, there is a wrinkle, because most of my testing has been done against localhost. When I use real world network speeds and latencies, `react-dom-stream` often beats React significantly in both TTFB and TTLB. This is probably because `react-dom-stream`'s faster time to first byte gets a headstart on filling up the network pipe.

One other operational challenge that `react-dom-stream` can help with is introducing asynchronicity, which can allow requests for small pages to not get completely blocked by executing requests for large pages.

## Who?

`react-dom-stream` is written by Sasha Aickin ([@xander76](https://twitter.com/xander76)), though let's be real, about 99% of the code is forked from Facebook's React.

## Status

This project is of beta quality; I don't know if it has been used in production yet, and the API is still firming up. It does, however, pass all of the automated tests that are currently run on `react-dom` in the main React project plus one or two dozen more that I've written.

This module is forked from Facebook's React project. All extra code and modifications are offered under the Apache 2.0 license.

## Something's wrong!

Please feel free to file any issues at <https://github.com/aickin/react-dom-stream>. Thanks!

## Upgrading from previous versions

There were major breaking API changes in v0.2 and v0.4. To learn how to upgrade your client code, please read [CHANGELOG.md](/CHANGELOG.md).

## Wait, where's the code?

Well, this is awkward.

You may have noticed that all of the server-side rendering code is in a directory called `lib` and `dist`, which is not checked in to the `react-dom-stream` repo. That's because most of the interesting code is over at <https://github.com/aickin/react/tree/streaming-render-0.2>, which is a fork of React. Specifically, check out [this commit](https://github.com/aickin/react/commit/9159656c53c0335ec6bd56fc7537231a9abeb5d5) to see most of the interesting changes from React 0.14.


## I'd like to contribute!

Awesome. You are the coolest.

To get a working build running and learn a little about how the project is set up, please read [CONTRIBUTING.md](CONTRIBUTING.md).

If you'd like to send PRs to either repo, please feel free! I'll require a CLA before pulling code to keep rights clean, but we can figure that out when we get there.

Please note that this project adheres to the [Open Code of Conduct][code-of-conduct]. By participating, you are expected to honor this code.
[code-of-conduct]: http://todogroup.org/opencodeofconduct/#react-dom-stream/xander76@yahoo.com
