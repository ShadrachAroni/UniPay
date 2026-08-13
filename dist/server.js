"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = require("./app.js");
const logger_js_1 = require("./utils/logger.js");
const PORT = process.env.PORT || 3000;
const { app } = (0, app_js_1.createApp)();
app.listen(PORT, () => {
    logger_js_1.logger.info(`UniPay Backend Server running on port ${PORT}`);
});
