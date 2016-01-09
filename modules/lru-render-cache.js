import LRU from "lru-cache"

class LRURenderCache {
	constructor(options = {}) {
		if (Number.isInteger(options)) {
			options = {
				max:options
			};
		}

		let originalDispose = options.dispose;

		this.lruCache = LRU({
			max: options.max || 128 * 1024 * 1024,

			length: (value, key) => {
				return value.value.length + (value.key.length * 2);
			},

			dispose: (key, value) => {
				const componentMap = this._getComponentMap(value.component);
				componentMap.delete(value.key);
				if (componentMap.size === 0) {
					this.map.delete(value.component);
				}
				originalDispose(key, value);
			},
		});
		
		this.map = new Map();
	}

	get(component, key) {
		const lruCacheKey = this._getComponentMap(component).get(key);
		const storedValue = this.lruCache.get(lruCacheKey);
		if (typeof storedValue === "object") {
			return storedValue.value;
		}
		return undefined;
	}

	set(component, key, value) {
		const lruCacheKey = {};
		this._getComponentMap(component).set(key, lruCacheKey);
		this.lruCache.set(lruCacheKey, {component, key, value});
	}

	_getComponentMap(component) {
		var componentMap = this.map.get(component);

		if (!componentMap) {
		  componentMap = new Map();
		  this.map.set(component, componentMap);
		}

		return componentMap;
	}
}

export default options => new LRURenderCache(options);