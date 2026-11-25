"use strict";

(() => {
  const router = KasmAgentCore.createRouter(browser, KasmProtocol);
  const connection = KasmAgentTransport.createConnection({
    browser,
    protocol: KasmProtocol,
    router,
    safeError: KasmAgentCore.safeError,
    // Only constant event/error codes are logged. No commands, page data,
    // managed settings, socket objects, or network exceptions reach this sink.
    logger: entry => console.info(JSON.stringify(entry))
  });
  void connection.start();
})();
