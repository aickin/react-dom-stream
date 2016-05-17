import { Component } from "React";
import hoistStatics from 'hoist-non-react-statics'

const defaultCacheKey = props => JSON.stringify(props);

export default function cache(componentCacheKey) {
  const cacheKey = componentCacheKey || defaultCacheKey;

  return function wrapWithCache(WrappedComponent) {
    const cacheDisplayName = `Cache(${getDisplayName(WrappedComponent)})`;

    class Cache extends Component {
      componentCacheKey() {
        return cacheKey(this.props);
      }
      render() {
        return <WrappedComponent {...this.props} />;
      }
    }

    Cache.displayName = cacheDisplayName;
    Cache.WrappedComponent = WrappedComponent;

    return hoistStatics(Cache, WrappedComponent);
  }
}
