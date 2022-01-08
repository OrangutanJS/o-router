import renderIfHtmlElementGiven from "../utils/renderIfHtmlElementGiven";
import routesFilter from "../utils/routesFilter";
import setOnPopStateEvent from "../utils/setOnPopStateEvent";
import decodeSearchQuery from "../utils/decodeSearchQuery";
import createUrlObject from "../utils/createUrlObject";
import splitAndFilterPath from "../utils/splitAndFilterPath";
import decodeParameters from "../utils/decodeParameters";
import encodeSearchQuery from "../utils/encodeSearchQuery";

export class oRouter {
  static originPrefix = '';
  static routingTable = {};
  static #routingParameters = {};

  static set defaultView(value) {
    if (!value || !(typeof value === 'function')) {
      return false;
    }
    oRouter.#defaultView = value;
  }

  static get routingParameters() {
    return oRouter.#routingParameters;
  }

  static set routingParameters(value) {
    return value;
  }

  static #defaultView = () => null;

  static redirect(path, parameters) {
    oRouter.route(path, parameters);
  }

  static route(givenPath, givenParameters) {
    setOnPopStateEvent(oRouter.route);
    var renderFunctionResult;
    const url = createUrlObject(givenPath, oRouter.originPrefix);

    oRouter.#routingParameters = {
      fullPath: url.href.replace(url.origin, ''),
      url,
      searchParameters: decodeSearchQuery(url.search),
      hash: url.hash,
      parameters: {}
    };

    if (typeof givenParameters === 'object') {
      Object.assign(oRouter.#routingParameters, givenParameters);
    }

    const splittedPath = splitAndFilterPath(url.pathname, oRouter.originPrefix);
    if (!splittedPath.length) {
      oRouter.#changeState(url);
      renderFunctionResult = oRouter.#defaultView(oRouter.#routingParameters);
      renderIfHtmlElementGiven(renderFunctionResult);
      return true;
    }

    const routesFiltered = routesFilter(splittedPath, oRouter.routingTable);
    if (!routesFiltered.length) {
      const { url } = oRouter.#routingParameters;
      if (!oRouter.routingTable['404-notFound']) {
        return false;
      }
      oRouter.#changeState(url);
      renderFunctionResult = oRouter.routingTable['404-notFound'](oRouter.#routingParameters);
      renderIfHtmlElementGiven(renderFunctionResult);
      return false;
    }

    const foundRoute = routesFiltered[0];
    Object.assign(
      oRouter.#routingParameters.parameters,
      decodeParameters(foundRoute, splittedPath)
    );

    oRouter.#changeState(url);
    renderFunctionResult = oRouter.routingTable[foundRoute.full](oRouter.#routingParameters);
    renderIfHtmlElementGiven(renderFunctionResult);
    return true;
  }

  static setSearchParameter(key, value) {
    if (!key || typeof key !== 'string' || typeof value === 'object') return false;
    return oRouter.setSearchParameters({
      [key]: String(value)
    });
  }

  static unsetSearchParameter(key) {
    if (!oRouter.#routingParameters.searchParameters[key]) return false;

    delete oRouter.#routingParameters.searchParameters[key];

    const { url } = oRouter.#routingParameters;
    let parametersStr = oRouter.#searchParametersToString();

    url.search = `?${parametersStr}`;
    return oRouter.#changeState(url);
  }

  static setSearchParameters(parameters) {
    if (typeof parameters !== 'object') return false;
    if (!Object.keys(parameters).length) return true;

    const { url } = oRouter.#routingParameters;

    url.search = oRouter.#searchParametersToString(parameters);
    return oRouter.#changeState(url);
  }

  static unsetSearchParametersAll() {
    const { url } = oRouter.#routingParameters;
    const searchParameters = decodeSearchQuery(url.search);
    Object.keys(searchParameters).forEach(searchParameter => oRouter.unsetSearchParameter(searchParameter));

    return oRouter.#changeState(url);
  }

  static setHash(hash) {
    if (!hash || typeof hash === 'object') return false;

    hash = String(hash);
    const { url } = oRouter.#routingParameters;

    if (hash.startsWith('#')) {
      hash = hash.substring(1);
    }
    const alreadyInRegExp = new RegExp(`#?${hash}(#|$)`, 'i');
    if (alreadyInRegExp.test(url.hash)) return true;

    url.hash += '#' + hash;

    return oRouter.#changeState(url);
  }

  static unsetHash(hash) {
    if (!hash || typeof hash === 'object') return false;

    hash = String(hash);
    const { url } = oRouter.#routingParameters;

    if (hash.startsWith('#')) {
      hash = hash.substring(1);
    }
    const alreadyInRegExp = new RegExp(`#?${hash}(#|$)`, 'i');
    url.hash = url.hash.replace(alreadyInRegExp, '');

    return oRouter.#changeState(url);
  }

  static unsetHashAll() {
    const { url } = oRouter.#routingParameters;
    const hashes = url.hash.split('#').filter(hash => hash !== '');
    hashes.forEach(hash => oRouter.unsetHash(hash));
  }

  static isSetHash(hash) {
    const alreadyInRegExp = new RegExp(`#?${hash}(#|$)`);
    const { url } = oRouter.#routingParameters;
    return alreadyInRegExp.test(url.hash);
  }

  static back() {
    window.history.back();
  }

  static #searchParametersToString(searchParameters) {
    if (searchParameters) {
      Object.assign(
        oRouter.#routingParameters.searchParameters,
        searchParameters
      );
    }

    return encodeSearchQuery(oRouter.#routingParameters.searchParameters);
  }

  // Section: private methods
  static #changeState(url) {
    const { pathname } = url;
    oRouter.#routingParameters.fullPath = url.href.replace(url.origin, '');
    try {
      if (pathname === window.location.pathname) {
        window.history.replaceState(
          JSON.parse(JSON.stringify(oRouter.#routingParameters)),
          document.title,
          url
        );
      } else {
        const state = { ...oRouter.#routingParameters, redirectedFrom: window.location.pathname };
        window.history.pushState(
          JSON.parse(JSON.stringify(state)),
          document.title,
          url
        );
      }
      return true;
    } catch (e) {
      console.warn(e);
      return false;
    }
  }
}