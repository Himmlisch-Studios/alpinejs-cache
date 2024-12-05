/**
 * @typedef CacheRecord
 * @type {{ data: any, expires_at: number }}
 */

/**
 * @typedef CacheStorageDriver
 * @type {{ setItem: (key: string, record: CacheRecord) => void, getItem: (key: string) => ?CacheRecord }}
 */


/**
 * @type {CacheStorageDriver}
 */
const defaultStorageDriver = {
    setItem(key, record) {
        return localStorage.setItem(key, JSON.stringify(record));
    },
    getItem(key) {
        const data = localStorage.getItem(key);

        if (data !== undefined) {
            return JSON.parse(data);
        }

        return null;
    },
}


/** @type {import("alpinejs").PluginCallback} */
const cache = function (Alpine) {
    /** @type {Map<CacheStorageDriver, Map<string,Set<(val: any) => void>>>} */
    const setters = new Map;
    const staticHandler = (key, data, storage) => {
        for (const setter of setterSpace(storage, key)) {
            setter(data);
        }
    };
    /**
     * @param {CacheStorageDriver} storage
     * @param {string} key
     */
    const setterSpace = (storage, key) => {
        if (!setters.has(storage)) {
            setters.set(storage, new Map);
        }

        if (!setters.get(storage).has(key)) {
            setters.get(storage).set(key, new Set);
        }

        return setters.get(storage).get(key);
    }

    let cache = () => {
        /** @type {string} */
        let alias;
        /** @type {number} */
        let seconds;
        /** @type {CacheStorageDriver} */
        let storage;

        storage = cacheUtils.defaultDriver;

        return Alpine.interceptor((initialValue, getter, setter, path) => {
            let lookup = keyname(alias || path);
            let time = seconds || 60;
            let shouldSave = false;

            setterSpace(storage, lookup).add(setter);

            /** @type {CacheRecord} */
            let initial;

            if (storageHas(lookup, storage)) {
                initial = storageGet(lookup, storage)
            } else {
                shouldSave = true;
                initial = {
                    data: initialValue,
                    expires_at: now() + time * 1000
                };
            }

            Alpine.effect(() => {
                let value = getter()

                if (!value?._x_interceptor) {
                    if (shouldSave) {
                        storageSet(lookup, value, time, storage)
                    }
                    shouldSave = true;
                };

                setter(value)
            })

            return initial.data
        }, func => {
            func.as = key => { alias = key; return func }
            func.for = long => { seconds = long; return func }
            func.until = time => { seconds = Math.max(time - now(), 0); return func }
            func.using = target => { storage = target; return func }
        })
    }

    Object.defineProperty(Alpine, '$cache', { get: () => cache() });

    Alpine.magic('cache', cache)

    const cacheUtils = {
        /** @property {CacheStorageDriver} */
        defaultDriver: defaultStorageDriver,
        invalidate: (key, storage = null) => {
            key = keyname(key);
            storageSet(key, undefined, 0, storage || cacheUtils.defaultDriver)
            staticHandler(key, undefined, storage || cacheUtils.defaultDriver);
        },
        set: (key, data, time, storage = null) => {
            key = keyname(key);
            storageSet(key, data, time, storage || cacheUtils.defaultDriver)
            staticHandler(key, data, storage || cacheUtils.defaultDriver);
        },
        get: (key, storage = null) => {
            key = keyname(key);
            return storageGet(key, storage || cacheUtils.defaultDriver)?.data
        }
    };

    Alpine.cache = cacheUtils;
}

function keyname(key) {
    return `_cache_${key}`;
}

function now() {
    return Date.now();
}

/**
 *
 * @param {string} key
 * @param {CacheStorageDriver} storage
 * @returns {bool}
 */
function storageHas(key, storage) {
    return storageGet(key, storage) !== undefined;
}

/**
 *
 * @param {string} key
 * @param {CacheStorageDriver} storage
 * @returns {?CacheRecord}
 */
function storageGet(key, storage) {
    const data = storage.getItem(key);

    if (!data?.expires_at || now() > data?.expires_at) return; // Has expired

    return data;
}

/**
 * @param {string} key
 * @param {any} data
 * @param {number} seconds
 * @param {CacheStorageDriver} storage
 * @returns {void}
 */
function storageSet(key, data, seconds, storage) {
    const expires_at = now() + seconds * 1000;

    const record = Object.create(null);
    storage.setItem(key, {
        data,
        expires_at
    })
}

export default cache;
