export const id = 360;
export const ids = [360];
export const modules = {

/***/ 1360:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   rateLimiter: () => (/* binding */ rateLimiter)
/* harmony export */ });
/* unused harmony exports MemoryStore, RedisStore, UnstorageStore, webSocketLimiter */
const getResetSeconds = (resetTime, windowMs) => {
  let resetSeconds;
  if (resetTime) {
    const deltaSeconds = Math.ceil((resetTime.getTime() - Date.now()) / 1e3);
    resetSeconds = Math.max(0, deltaSeconds);
  } else if (windowMs) {
    resetSeconds = Math.ceil(windowMs / 1e3);
  }
  return resetSeconds;
};
const setDraft6Headers = (context, info, windowMs) => {
  if (context.finalized) return;
  const windowSeconds = Math.ceil(windowMs / 1e3);
  const resetSeconds = getResetSeconds(info.resetTime);
  context.header("RateLimit-Policy", `${info.limit};w=${windowSeconds}`);
  context.header("RateLimit-Limit", info.limit.toString());
  context.header("RateLimit-Remaining", info.remaining.toString());
  if (resetSeconds) context.header("RateLimit-Reset", resetSeconds.toString());
};
const setDraft7Headers = (context, info, windowMs) => {
  if (context.finalized) return;
  const windowSeconds = Math.ceil(windowMs / 1e3);
  const resetSeconds = getResetSeconds(info.resetTime, windowMs);
  context.header("RateLimit-Policy", `${info.limit};w=${windowSeconds}`);
  context.header(
    "RateLimit",
    `limit=${info.limit}, remaining=${info.remaining}, reset=${resetSeconds}`
  );
};
const setRetryAfterHeader = (context, info, windowMs) => {
  if (context.finalized) return;
  const resetSeconds = getResetSeconds(info.resetTime, windowMs);
  context.header("Retry-After", resetSeconds?.toString());
};

class MemoryStore {
  constructor() {
    /**
     * These two maps store usage (requests) and reset time by key (for example, IP
     * addresses or API keys).
     *
     * They are split into two to avoid having to iterate through the entire set to
     * determine which ones need reset. Instead, `Client`s are moved from `previous`
     * to `current` as they hit the endpoint. Once `windowMs` has elapsed, all clients
     * left in `previous`, i.e., those that have not made any recent requests, are
     * known to be expired and can be deleted in bulk.
     */
    this.previous = /* @__PURE__ */ new Map();
    this.current = /* @__PURE__ */ new Map();
  }
  /**
   * The duration of time before which all hit counts are reset (in milliseconds).
   */
  #windowMs;
  /**
   * Method that initializes the store.
   *
   * @param options {HonoConfigType | WSConfigType} - The options used to setup the middleware.
   */
  init(options) {
    this.#windowMs = options.windowMs;
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => {
      this.clearExpired();
    }, this.#windowMs);
    if (this.interval.unref) this.interval.unref();
  }
  /**
   * Method to fetch a client's hit count and reset time.
   *
   * @param key {string} - The identifier for a client.
   *
   * @returns {ClientRateLimitInfo | undefined} - The number of hits and reset time for that client.
   *
   * @public
   */
  get(key) {
    return this.current.get(key) ?? this.previous.get(key);
  }
  /**
   * Method to increment a client's hit counter.
   *
   * @param key {string} - The identifier for a client.
   *
   * @returns {ClientRateLimitInfo} - The number of hits and reset time for that client.
   *
   * @public
   */
  increment(key) {
    const client = this.getClient(key);
    const now = Date.now();
    if (client.resetTime.getTime() <= now) {
      this.resetClient(client, now);
    }
    client.totalHits++;
    return client;
  }
  /**
   * Method to decrement a client's hit counter.
   *
   * @param key {string} - The identifier for a client.
   *
   * @public
   */
  decrement(key) {
    const client = this.getClient(key);
    if (client.totalHits > 0) client.totalHits--;
  }
  /**
   * Method to reset a client's hit counter.
   *
   * @param key {string} - The identifier for a client.
   *
   * @public
   */
  resetKey(key) {
    this.current.delete(key);
    this.previous.delete(key);
  }
  /**
   * Method to reset everyone's hit counter.
   *
   * @public
   */
  resetAll() {
    this.current.clear();
    this.previous.clear();
  }
  /**
   * Method to stop the timer (if currently running) and prevent any memory
   * leaks.
   *
   * @public
   */
  shutdown() {
    clearInterval(this.interval);
    void this.resetAll();
  }
  /**
   * Recycles a client by setting its hit count to zero, and reset time to
   * `windowMs` milliseconds from now.
   *
   * NOT to be confused with `#resetKey()`, which removes a client from both the
   * `current` and `previous` maps.
   *
   * @param client {Client} - The client to recycle.
   * @param now {number} - The current time, to which the `windowMs` is added to get the `resetTime` for the client.
   *
   * @return {Client} - The modified client that was passed in, to allow for chaining.
   */
  resetClient(client, now = Date.now()) {
    client.totalHits = 0;
    client.resetTime.setTime(now + this.#windowMs);
    return client;
  }
  /**
   * Retrieves or creates a client, given a key. Also ensures that the client being
   * returned is in the `current` map.
   *
   * @param key {string} - The key under which the client is (or is to be) stored.
   *
   * @returns {Client} - The requested client.
   */
  getClient(key) {
    const currentKey = this.current.get(key);
    if (currentKey) return currentKey;
    let client;
    const previousKey = this.previous.get(key);
    if (previousKey) {
      client = previousKey;
      this.previous.delete(key);
    } else {
      client = { totalHits: 0, resetTime: /* @__PURE__ */ new Date() };
      this.resetClient(client);
    }
    this.current.set(key, client);
    return client;
  }
  /**
   * Move current clients to previous, create a new map for current.
   *
   * This function is called every `windowMs`.
   */
  clearExpired() {
    this.previous = this.current;
    this.current = /* @__PURE__ */ new Map();
  }
}

const isValidStore = (value) => !!value?.increment;
function initStore(store, options) {
  if (!isValidStore(store)) {
    throw new Error("The store is not correctly implemented!");
  }
  if (typeof store.init === "function") {
    store.init(options);
  }
}

function rateLimiter(config) {
  if ("binding" in config && config.binding !== void 0) {
    return cloudflareRateLimiter(config);
  }
  return honoRateLimiter(config);
}
function honoRateLimiter(config) {
  const {
    windowMs = 6e4,
    limit = 5,
    message = "Too many requests, please try again later.",
    statusCode = 429,
    standardHeaders = "draft-6",
    requestPropertyName = "rateLimit",
    requestStorePropertyName = "rateLimitStore",
    skipFailedRequests = false,
    skipSuccessfulRequests = false,
    keyGenerator,
    skip = () => false,
    requestWasSuccessful = (c) => c.res.status < 400,
    handler = async (c, _, options2) => {
      c.status(options2.statusCode);
      const responseMessage = typeof options2.message === "function" ? await options2.message(c) : options2.message;
      if (typeof responseMessage === "string") return c.text(responseMessage);
      return c.json(responseMessage);
    },
    store = new MemoryStore()
  } = config;
  const options = {
    windowMs,
    limit,
    message,
    statusCode,
    standardHeaders,
    requestPropertyName,
    requestStorePropertyName,
    skipFailedRequests,
    skipSuccessfulRequests,
    keyGenerator,
    skip,
    requestWasSuccessful,
    handler,
    store
  };
  initStore(store, options);
  return async (c, next) => {
    const isSkippable = await skip(c);
    if (isSkippable) {
      await next();
      return;
    }
    const key = await keyGenerator(c);
    const { totalHits, resetTime } = await store.increment(key);
    const retrieveLimit = typeof limit === "function" ? limit(c) : limit;
    const _limit = await retrieveLimit;
    const info = {
      limit: _limit,
      used: totalHits,
      remaining: Math.max(_limit - totalHits, 0),
      resetTime
    };
    c.set(requestPropertyName, info);
    c.set(requestStorePropertyName, {
      getKey: store.get?.bind(store),
      resetKey: store.resetKey.bind(store)
    });
    if (standardHeaders && !c.finalized) {
      if (standardHeaders === "draft-7") {
        setDraft7Headers(c, info, windowMs);
      } else {
        setDraft6Headers(c, info, windowMs);
      }
    }
    let decremented = false;
    const decrementKey = async () => {
      if (!decremented) {
        await store.decrement(key);
        decremented = true;
      }
    };
    const shouldSkipRequest = async () => {
      if (skipFailedRequests || skipSuccessfulRequests) {
        const wasRequestSuccessful = await requestWasSuccessful(c);
        if (skipFailedRequests && !wasRequestSuccessful || skipSuccessfulRequests && wasRequestSuccessful)
          await decrementKey();
      }
    };
    if (totalHits > _limit) {
      if (standardHeaders) {
        setRetryAfterHeader(c, info, windowMs);
      }
      await shouldSkipRequest();
      return handler(c, next, options);
    }
    try {
      await next();
      await shouldSkipRequest();
    } catch (error) {
      if (skipFailedRequests) await decrementKey();
      throw error;
    }
  };
}
function cloudflareRateLimiter(config) {
  const {
    message = "Too many requests, please try again later.",
    statusCode = 429,
    binding: bindingProp,
    keyGenerator,
    skip = () => false,
    handler = async (c, _, options) => {
      c.status(options.statusCode);
      const responseMessage = typeof options.message === "function" ? await options.message(c) : options.message;
      if (typeof responseMessage === "string") return c.text(responseMessage);
      return c.json(responseMessage);
    }
  } = config;
  return async (c, next) => {
    let rateLimitBinding = bindingProp;
    if (typeof rateLimitBinding === "function") {
      rateLimitBinding = rateLimitBinding(c);
    }
    const options = {
      message,
      statusCode,
      binding: rateLimitBinding,
      keyGenerator,
      skip,
      handler
    };
    const isSkippable = await skip(c);
    if (isSkippable) {
      await next();
      return;
    }
    const key = await keyGenerator(c);
    const { success } = await rateLimitBinding.limit({ key });
    if (!success) {
      return handler(c, next, options);
    }
    await next();
  };
}

const scripts = {
  increment: `
      local totalHits = redis.call("INCR", KEYS[1])
      local timeToExpire = redis.call("PTTL", KEYS[1])
      if timeToExpire <= 0 or ARGV[1] == "1"
      then
        redis.call("PEXPIRE", KEYS[1], tonumber(ARGV[2]))
        timeToExpire = tonumber(ARGV[2])
      end

      return { totalHits, timeToExpire }
		`.replaceAll(/^\s+/gm, "").trim(),
  get: `
      local totalHits = redis.call("GET", KEYS[1])
      local timeToExpire = redis.call("PTTL", KEYS[1])

      return { totalHits, timeToExpire }
		`.replaceAll(/^\s+/gm, "").trim()
};

const toInt = (input) => {
  if (typeof input === "number") return input;
  return Number.parseInt((input ?? "").toString(), 10);
};
const parseScriptResponse = (results) => {
  if (!Array.isArray(results))
    throw new TypeError("Expected result to be array of values");
  if (results.length !== 2)
    throw new Error(`Expected 2 replies, got ${results.length}`);
  const totalHits = results[0] === false ? 0 : toInt(results[0]);
  const timeToExpire = toInt(results[1]);
  const resetTime = new Date(Date.now() + timeToExpire);
  return { totalHits, resetTime };
};
class RedisStore {
  /**
   * @constructor for `RedisStore`.
   *
   * @param options {Options} - The configuration options for the store.
   */
  constructor(options) {
    this.client = options.client;
    this.prefix = options.prefix ?? "hrl:";
    this.resetExpiryOnChange = options.resetExpiryOnChange ?? false;
    this.incrementScriptSha = this.loadIncrementScript();
    this.getScriptSha = this.loadGetScript();
  }
  /**
   * Loads the script used to increment a client's hit count.
   */
  async loadIncrementScript() {
    const result = await this.client.scriptLoad(scripts.increment);
    if (typeof result !== "string") {
      throw new TypeError("unexpected reply from redis client");
    }
    return result;
  }
  /**
   * Loads the script used to fetch a client's hit count and expiry time.
   */
  async loadGetScript() {
    const result = await this.client.scriptLoad(scripts.get);
    if (typeof result !== "string") {
      throw new TypeError("unexpected reply from redis client");
    }
    return result;
  }
  /**
   * Runs the increment command, and retries it if the script is not loaded.
   */
  async retryableIncrement(key) {
    const evalCommand = async () => this.client.evalsha(
      await this.incrementScriptSha,
      [this.prefixKey(key)],
      [this.resetExpiryOnChange ? "1" : "0", this.windowMs.toString()]
    );
    try {
      const result = await evalCommand();
      return result;
    } catch {
      this.incrementScriptSha = this.loadIncrementScript();
      return evalCommand();
    }
  }
  /**
   * Method to prefix the keys with the given text.
   *
   * @param key {string} - The key.
   *
   * @returns {string} - The text + the key.
   */
  prefixKey(key) {
    return `${this.prefix}${key}`;
  }
  /**
   * Method that actually initializes the store.
   *
   * @param options {RateLimitConfiguration} - The options used to setup the middleware.
   */
  init(options) {
    this.windowMs = options.windowMs;
  }
  /**
   * Method to fetch a client's hit count and reset time.
   *
   * @param key {string} - The identifier for a client.
   *
   * @returns {ClientRateLimitInfo | undefined} - The number of hits and reset time for that client.
   */
  async get(key) {
    const results = await this.client.evalsha(
      await this.getScriptSha,
      [this.prefixKey(key)],
      []
    );
    return parseScriptResponse(results);
  }
  /**
   * Method to increment a client's hit counter.
   *
   * @param key {string} - The identifier for a client
   *
   * @returns {ClientRateLimitInfo} - The number of hits and reset time for that client
   */
  async increment(key) {
    const results = await this.retryableIncrement(key);
    return parseScriptResponse(results);
  }
  /**
   * Method to decrement a client's hit counter.
   *
   * @param key {string} - The identifier for a client
   */
  async decrement(key) {
    await this.client.decr(this.prefixKey(key));
  }
  /**
   * Method to reset a client's hit counter.
   *
   * @param key {string} - The identifier for a client
   */
  async resetKey(key) {
    await this.client.del(this.prefixKey(key));
  }
}

class UnstorageStore {
  /**
   * @constructor for `UnstorageStore`.
   *
   * @param options {Options} - The configuration options for the store.
   */
  constructor(options) {
    this.storage = options.storage;
    this.prefix = options.prefix ?? "hrl:";
  }
  /**
   * Method to prefix the keys with the given text.
   *
   * @param key {string} - The key.
   *
   * @returns {string} - The text + the key.
   */
  prefixKey(key) {
    return `${this.prefix}${key}`;
  }
  /**
   * Method that actually initializes the store.
   *
   * @param options {HonoConfigType} - The options used to setup the middleware.
   */
  init(options) {
    this.windowMs = options.windowMs;
  }
  /**
   * Method to fetch a client's hit count and reset time.
   *
   * @param key {string} - The identifier for a client.
   *
   * @returns {ClientRateLimitInfo | undefined} - The number of hits and reset time for that client.
   */
  async get(key) {
    const result = await this.storage.get(this.prefixKey(key)).then(
      (value) => value ? JSON.parse(String(value)) : void 0
    );
    return result;
  }
  /**
   * Method to increment a client's hit counter. If the current time is within an active window,
   * it increments the existing hit count. Otherwise, it starts a new window with a hit count of 1.
   *
   * @param key {string} - The identifier for a client
   *
   * @returns {ClientRateLimitInfo} - An object containing:
   *   - totalHits: The updated number of hits for the client
   *   - resetTime: The time when the current rate limit window expires
   */
  async increment(key) {
    const nowMS = Date.now();
    const record = await this.get(key);
    const defaultResetTime = new Date(nowMS + this.windowMs);
    const existingResetTimeMS = record?.resetTime && new Date(record.resetTime).getTime();
    const isActiveWindow = existingResetTimeMS && existingResetTimeMS > nowMS;
    const payload = {
      totalHits: isActiveWindow ? record.totalHits + 1 : 1,
      resetTime: isActiveWindow && existingResetTimeMS ? new Date(existingResetTimeMS) : defaultResetTime
    };
    await this.updateRecord(key, payload);
    return payload;
  }
  /**
   * Method to decrement a client's hit counter. Only decrements if there is an active time window.
   * The hit counter will never go below 0.
   *
   * @param key {string} - The identifier for a client
   * @returns {Promise<void>} - Returns void after attempting to decrement the counter
   */
  async decrement(key) {
    const nowMS = Date.now();
    const record = await this.get(key);
    const existingResetTimeMS = record?.resetTime && new Date(record.resetTime).getTime();
    const isActiveWindow = existingResetTimeMS && existingResetTimeMS > nowMS;
    if (isActiveWindow && record) {
      const payload = {
        totalHits: Math.max(0, record.totalHits - 1),
        // Never go below 0
        resetTime: new Date(existingResetTimeMS)
      };
      await this.updateRecord(key, payload);
    }
    return;
  }
  /**
   * Method to reset a client's hit counter.
   *
   * @param key {string} - The identifier for a client
   */
  async resetKey(key) {
    await this.storage.remove(this.prefixKey(key));
  }
  /**
   * Method to update a record.
   *
   * @param key {string} - The identifier for a client.
   * @param payload {ClientRateLimitInfo} - The payload to update.
   */
  async updateRecord(key, payload) {
    await this.storage.set(this.prefixKey(key), JSON.stringify(payload));
  }
}

function webSocketLimiter(config) {
  const {
    windowMs = 6e4,
    limit = 5,
    message = "Too many requests, please try again later.",
    statusCode = 1008,
    requestPropertyName = "rateLimit",
    requestStorePropertyName = "rateLimitStore",
    skipFailedRequests = false,
    skipSuccessfulRequests = false,
    keyGenerator,
    skip = () => false,
    handler = async (_, ws, options2) => ws.close(options2.statusCode, options2.message),
    store = new MemoryStore()
  } = config;
  const options = {
    windowMs,
    limit,
    message,
    statusCode,
    requestPropertyName,
    requestStorePropertyName,
    skipFailedRequests,
    skipSuccessfulRequests,
    keyGenerator,
    skip,
    handler,
    store
  };
  initStore(store, options);
  return (createEvents) => async (c) => {
    const events = await createEvents(c);
    return {
      ...events,
      onMessage: async (event, ws) => {
        const isSkippable = await skip(event, ws);
        if (isSkippable) {
          await events.onMessage?.(event, ws);
          return;
        }
        const key = await keyGenerator(c);
        const { totalHits, resetTime } = await store.increment(key);
        const retrieveLimit = typeof limit === "function" ? limit(c) : limit;
        const _limit = await retrieveLimit;
        const info = {
          limit: _limit,
          used: totalHits,
          remaining: Math.max(_limit - totalHits, 0),
          resetTime
        };
        c.set(requestPropertyName, info);
        c.set(requestStorePropertyName, {
          getKey: store.get?.bind(store),
          resetKey: store.resetKey.bind(store)
        });
        let decremented = false;
        const decrementKey = async () => {
          if (!decremented) {
            await store.decrement(key);
            decremented = true;
          }
        };
        const shouldSkipRequest = async () => {
          if (skipSuccessfulRequests) await decrementKey();
        };
        if (totalHits > _limit) {
          await shouldSkipRequest();
          return handler(event, ws, options);
        }
        try {
          await events.onMessage?.(event, ws);
          await shouldSkipRequest();
        } catch (error) {
          if (skipFailedRequests) await decrementKey();
          throw error;
        }
      },
      onError: async (event, ws) => {
        if (skipFailedRequests) {
          const key = await keyGenerator(c);
          await store.decrement(key);
        }
        events.onError?.(event, ws);
      }
    };
  };
}




/***/ })

};
