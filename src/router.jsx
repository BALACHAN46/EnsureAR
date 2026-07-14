import React, { useState, useEffect } from 'react';

// Hash-based routing context
export const RouteContext = React.createContext({
  route: '/',
  params: {},
  navigate: () => {},
});

/**
 * Parses hash like "#/admin/model/abc123/edit"
 * into { path: '/admin/model/abc123/edit', params: {} }
 */
function parseHash(hash) {
  const raw = hash.replace(/^#/, '') || '/';
  return raw;
}

/**
 * Match a pattern like "/admin/model/:id/edit" against a path
 * Returns params object if matched, null otherwise.
 */
function matchRoute(pattern, path) {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');

  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

export function RouterProvider({ children }) {
  const [currentPath, setCurrentPath] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setCurrentPath(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (path) => {
    window.location.hash = path;
  };

  return (
    <RouteContext.Provider value={{ currentPath, navigate, matchRoute }}>
      {children}
    </RouteContext.Provider>
  );
}

export function useRouter() {
  return React.useContext(RouteContext);
}

/**
 * Renders children only if the current path matches the pattern.
 * Injects { params } into the child via cloneElement.
 */
export function Route({ pattern, component: Component }) {
  const { currentPath } = useRouter();
  const params = matchRoute(pattern, currentPath);
  if (params === null) return null;
  return <Component params={params} />;
}
