const Balancer = require('../lib/balancer.js');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const http = require('http');
const utils = require('./utils.js');

const expect = chai.expect;
chai.use(chaiAsPromised);

const ports = [
  4001,
  4002,
  4003,
  4004
]

describe('Proxy Balancer', () => {
  let servers;
  before(done => {
    servers = ports.map(port => utils.createProxyServer().listen(port));
    done();
  });

  after(done => {
    for(const server of servers) {
      server.close();
    }
    done();
  })

  it('should populate proxies using proxyFn', (done) => {
    const balancer = new Balancer({
      proxyFn() {
        return ports.map(port => 'http://127.0.0.1:' + port);
      }
    });

    balancer.getProxies().then(proxies => {
      for(const port of ports) {
        expect(proxies).to.deep.include('http://127.0.0.1:' + port);
      }
      done();
    });
  });

  it('should catch proxyFn error', async () => {
    const errorMsg = "Intended error";
    const balancer = new Balancer({
      proxyFn() {
        throw new Error(errorMsg);
      }
    });

    await expect(balancer.request()).to.be.rejectedWith(errorMsg);
  });

  it('should catch empty proxy list error', async () => {
    const balancer = new Balancer({
      proxyFn() {
        return [];
      }
    });

    await expect(balancer.request()).to.be.rejectedWith("Empty proxy list");
  });

  it('should use new proxy on each request - round robin', async () => {
    const balancer = new Balancer({
      proxyFn() {
        return ports.map(port => 'http://127.0.0.1:' + port);
      }
    });

    const first = await balancer.getNext();
    const second = await balancer.getNext();

    expect(first).to.equal('http://127.0.0.1:' + ports[0]);
    expect(second).to.equal('http://127.0.0.1:' + ports[1]);
  });

  it('should send request using proxy', (done) => {
    const balancer = new Balancer({
      proxyFn() {
        return ports.map(port => 'http://127.0.0.1:' + port);
      }
    });

    http.createServer((req, res) => {
      res.writeHead(200, {'Content-type':'text/plan'});
      res.write('test');
      res.end();
    }).listen(8080);

    balancer.request('http://127.0.0.1:8080')
      .then(res => res.text())
      .then(body => {
        expect(body).to.equal('test')
        done();
      })
  });
});