const axios = require('axios');
const crypto = require('crypto');
const readline = require('readline');
const winston = require('winston');
const fs = require('fs');
const inquirer = require('inquirer');
const colors = require('colors');
const { SocksProxyAgent } = require('socks-proxy-agent');
const url = require('url');
const path = require('path');

async function main() {
  const gradient = (await import('gradient-string')).default; // Dynamically import and access default export

  // Configuration class
  class Config {
    constructor() {
      this.baseURL = 'https://nodepay.org';
      this.ipCheckURL = 'https://ipinfo.io/json';
      this.pingURL = 'http://13.215.134.222/api/network/ping';
      this.retryInterval = 30000;
      this.sessionURL = 'http://api.nodepay.ai/api/auth/session';
    }
  }

  // Logger setup function
  function initLogger() {
    return winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta) : ''
          }`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'bot.log' }),
      ],
    });
  }

  // Proxy checker class
  class ProxyChecker {
    constructor(config, logger) {
      this.config = config;
      this.logger = logger;
    }

    async getProxyIP(proxy) {
      try {
        const response = await axios.get(this.config.ipCheckURL, {
          proxy: this.buildProxyConfig(proxy),
        });
        return response.data;
      } catch (error) {
        throw new Error(`Proxy ${proxy.host}:${proxy.port} is not working. Error: ${error.message}`);
      }
    }

    buildProxyConfig(proxy) {
      const proxyUrl = url.parse(proxy);
      if (proxyUrl.protocol === 'http:') {
        return {
          host: proxyUrl.hostname,
          port: parseInt(proxyUrl.port, 10),
          protocol: 'http',
        };
      } else if (proxyUrl.protocol === 'socks5:') {
        return new SocksProxyAgent(proxy); // SOCKS proxy
      }
      return null;
    }
  }

  // Bot class
  class Bot {
    constructor(config, logger) {
      this.config = config;
      this.logger = logger;
      this.proxyCheck = new ProxyChecker(config, logger);
    }

    async connect(token, proxy = null) {
      try {
        const userAgent = 'Mozilla/5.0 ... Safari/537.3';
        const accountInfo = await this.getSession(token, userAgent, proxy);

        console.log(`✅ ${'Connected'.green} for UID: ${accountInfo.uid}`);
        this.logger.info('Session information', {
          uid: accountInfo.uid,
          name: accountInfo.name,
          useProxy: !!proxy,
        });

        const interval = setInterval(async () => {
          try {
            await this.sendPing(accountInfo, token, userAgent, proxy);
          } catch (error) {
            console.log(`❌ ${'Ping send error'.red}: ${error.message}`);
            this.logger.error('Ping error', { error: error.message });
          }
        }, this.config.retryInterval);

        process.on('SIGINT', () => clearInterval(interval));
      } catch (error) {
        console.log(`❌ ${'Rejected'.red}: ${error.message}`);
        this.logger.error('Rejected', { error: error.message, proxy });
      }
    }

    async getSession(token, userAgent, proxy) {
      try {
        const config = {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': userAgent,
            Accept: 'application/json',
          },
        };

        if (proxy) {
          config.httpAgent = this.proxyCheck.buildProxyConfig(proxy);
        }

        const response = await axios.post(this.config.sessionURL, {}, config);
        return response.data.data;
      } catch (error) {
        throw new Error('Session request failed');
      }
    }

    async sendPing(accountInfo, token, userAgent, proxy) {
      const uid = accountInfo.uid || crypto.randomBytes(8).toString('hex');
      const browserId = accountInfo.browser_id || crypto.randomBytes(8).toString('hex');

      const pingData = {
        id: uid,
        browser_id: browserId,
        timestamp: Math.floor(Date.now() / 1000),
        version: '2.2.7',
      };

      const startTime = Date.now();

      try {
        const config = {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': userAgent,
            Accept: 'application/json',
          },
        };

        if (proxy) {
          config.httpAgent = this.proxyCheck.buildProxyConfig(proxy);
        }

        await axios.post(this.config.pingURL, pingData, config);

        const pingDuration = Date.now() - startTime;
        console.log(`📡 ${'Ping sent'.cyan} for UID: ${uid}`);

        const proxyInfo = proxy ? `Proxy IP: ${proxy.host}` : 'No proxy';
        const score = pingDuration < 5000 ? '✅ Good' : '✔️ Slow'; // Score based on ping time
        console.log(`Proxy used: ${proxyInfo}, Ping Duration: ${pingDuration}ms, Score: ${score}`);

        this.logger.info('Ping sent', {
          uid,
          browserId,
          ip: proxy ? proxy.host : 'No proxy',
          pingDuration,
          score,
        });
      } catch (error) {
        console.log(`❌ ${'Error with proxy'.red}: ${error.message}`);
        this.logger.error('Proxy error', { error: error.message, proxy });
        return;
      }
    }
  }

  // Helper functions
  async function readLines(filename) {
    const fileStream = fs.createReadStream(filename);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    const lines = [];
    for await (const line of rl) lines.push(line.trim());
    return lines;
  }

  // Decode Base64 encoded banner and display
  function displayHeader() {
    process.stdout.write('\x1Bc'); // Clear the console

    const base64Banner = `
      Kz09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSsKfCDilojilojilojilojilojilojilZcg4paI4paI4paI4paI4paI4paI4pWXIOKWiOKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVl+KWiOKWiOKVlyAgICDilojilojilojilZcgICDilojilojilojilZcg4paI4paI4paI4paI4paI4pWXIOKWiOKWiOKVlyAgICAgfAp84paI4paI4pWU4pWQ4pWQ4pWQ4paI4paI4pWX4paI4paI4pWU4pWQ4pWQ4paI4paI4pWX4pWa4pWQ4pWQ4paI4paI4pWU4pWQ4pWQ4pWd4paI4paI4pWRICAgIOKWiOKWiOKWiOKWiOKVlyDilojilojilojilojilZHilojilojilZTilZDilZDilojilojilZfilojilojilZEgICAgIHwKfOKWiOKWiOKVkSAgIOKWiOKWiOKVkeKWiOKWiOKWiOKWiOKWiOKWiOKVlOKVnSAgIOKWiOKWiOKVkSAgIOKWiOKWiOKVkSAgICDilojilojilZTilojilojilojilojilZTilojilojilZHilojilojilojilojilojilojilojilZHilojilojilZEgICAgIHwKfOKWiOKWiOKVkSAgIOKWiOKWiOKVkeKWiOKWiOKVlOKVkOKVkOKVkOKVnSAgICDilojilojilZEgICDilojilojilZEgICAg4paI4paI4pWR4pWa4paI4paI4pWU4pWd4paI4paI4pWR4paI4paI4pWU4pWQ4pWQ4paI4paI4pWR4paI4paI4pWRICAgICB8CnzilZrilojilojilojilojilojilojilZTilZ3ilojilojilZEgICAgICAgIOKWiOKWiOKVkSAgIOKWiOKWiOKVkSAgICDilojilojilZEg4pWa4pWQ4pWdIOKWiOKWiOKVkeKWiOKWiOKVkSAg4paI4paI4pWR4paI4paI4paI4paI4paI4paI4paI4pWXfAp8IOKVmuKVkOKVkOKVkOKVkOKVkOKVnSDilZrilZDilZ0gICAgICAgIOKVmuKVkOKVnSAgIOKVmuKVkOKVnSAgICDilZrilZDilZ0gICAgIOKVmuKVkOKVneKVmuKVkOKVnSAg4pWa4pWQ4pWd4pWa4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWdfAp8ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfAp8IOKWiOKWiOKWiOKWiOKWiOKWiOKVlyDilojilojilojilojilojilojilZcgIOKWiOKWiOKWiOKWiOKWiOKWiOKVlyDilojilojilZcgICAg4paI4paI4pWXICAgIOKWiOKWiOKVlyAgIOKWiOKWiOKVl+KWiOKWiOKWiOKWiOKWiOKWiOKWiOKWiOKVlyAgfAp84paI4paI4pWU4pWQ4pWQ4pWQ4pWQ4pWdIOKWiOKWiOKVlOKVkOKVkOKWiOKWiOKVl+KWiOKWiOKVlOKVkOKVkOKVkOKWiOKWiOKVl+KWiOKWiOKVkSAgICDilojilojilZEgICAg4pWa4paI4paI4pWXIOKWiOKWiOKVlOKVneKVmuKVkOKVkOKWiOKWiOKVlOKVkOKVkOKVnSAgfAp84paI4paI4pWRICDilojilojilojilZfilojilojilojilojilojilojilZTilZ3ilojilojilZEgICDilojilojilZHilojilojilZEg4paI4pWXIOKWiOKWiOKVkSAgICAg4pWa4paI4paI4paI4paI4pWU4pWdICAgIOKWiOKWiOKVkSAgICAgfAp84paI4paI4pWRICAg4paI4paI4pWR4paI4paI4pWU4pWQ4pWQ4paI4paI4pWX4paI4paI4pWRICAg4paI4paI4pWR4paI4paI4pWR4paI4paI4paI4pWX4paI4paI4pWRICAgICAg4pWa4paI4paI4pWU4pWdICAgICDilojilojilZEgICAgIHwKfOKVmuKWiOKWiOKWiOKWiOKWiOKWiOKVlOKVneKWiOKWiOKVkSAg4paI4paI4pWR4pWa4paI4paI4paI4paI4paI4paI4pWU4pWd4pWa4paI4paI4paI4pWU4paI4paI4paI4pWU4pWdICAgICAgIOKWiOKWiOKVkSAgICAgIOKWiOKWiOKVkSAgICAgfAp8IOKVmuKVkOKVkOKVkOKVkOKVkOKVnSDilZrilZDilZ0gIOKVmuKVkOKVnSDilZrilZDilZDilZDilZDilZDilZ0gIOKVmuKVkOKVkOKVneKVmuKVkOKVkOKVnSAgICAgICAg4pWa4pWQ4pWdICAgICAg4pWa4pWQ4pWdICAgICB8Cis9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0rCg==
    `;
    
    const decodedBanner = Buffer.from(base64Banner, 'base64').toString('utf-8');
    console.log(gradient.pastel(decodedBanner)); // Apply pastel gradient
    console.log();
  }

  // Main logic
  displayHeader();
  
  // Additional information
  console.log(colors.white.bold('CREATED BY : DR ABDUL MATIN KARIMI: ⨭ ' + colors.cyan('https://t.me/doctor_amk')));
  console.log(colors.white('DOWNLOAD LATEST HACKS HERE ➤ ' + colors.cyan('https://t.me/optimalgrowYT')));
  console.log(colors.red('LEARN HACKING HERE ➤ ' + colors.cyan('https://www.youtube.com/@optimalgrowYT/videos')));
  console.log(colors.red('DOWNLOAD MORE HACKS HERE ➤ ' + colors.cyan('https://github.com/OptimalGrowYT')));
  console.log(colors.yellow('PASTE YOUR (TOKEN) INTO TOKEN.TXT FILE AND PRESS START'));
  console.log(colors.green('                𝍖𝍖𝍖 𝙽𝙾𝙳𝙴𝙿𝙰𝚈 𝙷𝙰𝙲𝙺 𝙼𝙰𝚂𝚃𝙴𝚁 𝍖𝍖𝍖                 '));

  const config = new Config();
  const logger = initLogger();

  // Read tokens from token.txt file
  const tokens = await readLines('token.txt');
  if (tokens.length === 0) {
    console.log(`❌ ${'No tokens found'.red} in token.txt`);
    return;
  }

  // Read proxies from proxy.txt file
  const proxies = await readLines('proxy.txt');
  if (proxies.length === 0) {
    console.log(`❌ ${'No proxies found'.red} in proxy.txt`);
    return;
  }

  const token = tokens[0];
  const bot = new Bot(config, logger);

  // Connect for all proxies using one token, ignoring non-working proxies
  const promises = proxies.map((proxy) => {
    return bot.connect(token, proxy).catch((err) => {
      console.log(`❌ ${err.message}`.red);
    });
  });

  await Promise.all(promises);

  process.on('SIGINT', () => {
    console.log(`\n👋 ${'Shutting down...'.green}`);
    process.exit(0);
  });
}

main().catch((error) => console.log(`❌ ${error.message}`.red));
