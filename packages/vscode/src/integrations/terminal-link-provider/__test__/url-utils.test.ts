import { describe, it } from "mocha";
import * as assert from "assert";
import * as vscode from 'vscode';
import { extractHttpUrls, isLocalUrl, convertUrl } from "../url-utils";

describe('extractHttpUrls', () => {
  it('should extract a single http url', () => {
    const line = 'Visit http://localhost:8080 for info';
    const result = extractHttpUrls(line);
    const expectedUrlString = 'http://localhost:8080';
    const expectedUrl = vscode.Uri.parse(expectedUrlString);
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0].url.toJSON(), expectedUrl.toJSON());
    assert.strictEqual(result[0].start, 6);
    assert.strictEqual(result[0].length, expectedUrlString.length);
  });

  it('should extract multiple urls', () => {
    const line = 'a http://localhost b https://example.com/path';
    const result = extractHttpUrls(line);
    const expectedUrlString1 = 'http://localhost';
    const expectedUrl1 = vscode.Uri.parse(expectedUrlString1);
    const expectedUrlString2 = 'https://example.com/path';
    const expectedUrl2 = vscode.Uri.parse(expectedUrlString2);
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result[0].url.toJSON(), expectedUrl1.toJSON());
    assert.strictEqual(result[0].start, 2);
    assert.strictEqual(result[0].length, expectedUrlString1.length);
    assert.deepStrictEqual(result[1].url.toJSON(), expectedUrl2.toJSON());
    assert.strictEqual(result[1].start, 21);
    assert.strictEqual(result[1].length, expectedUrlString2.length);
  });

  it('should return empty for no urls', () => {
    assert.deepStrictEqual(extractHttpUrls('no urls here'), []);
  });

  it('should parse urls in quotes', () => {
    const line = 'Check "http://localhost:8080" for details';
    const result = extractHttpUrls(line);
    const expectedUrlString = 'http://localhost:8080';
    const expectedUrl = vscode.Uri.parse(expectedUrlString);
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0].url.toJSON(), expectedUrl.toJSON());
    assert.strictEqual(result[0].start, 7);
    assert.strictEqual(result[0].length, expectedUrlString.length);
  });

  it('should not include trailing colon', () => {
    const line = 'Listening:http://localhost:8080:';
    const result = extractHttpUrls(line);
    const expectedUrlString = 'http://localhost:8080';
    const expectedUrl = vscode.Uri.parse(expectedUrlString);
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0].url.toJSON(), expectedUrl.toJSON());
    assert.strictEqual(result[0].start, 10);
    assert.strictEqual(result[0].length, expectedUrlString.length);
  });

  it('should not include trailing comma', () => {
    const line = 'See: http://localhost:8080, http://localhost:8081, and https://localhost:8082.';
    const result = extractHttpUrls(line);
    const expectedUrlString1 = 'http://localhost:8080';
    const expectedUrl1 = vscode.Uri.parse(expectedUrlString1);
    const expectedUrlString2 = 'http://localhost:8081';
    const expectedUrl2 = vscode.Uri.parse(expectedUrlString2);
    const expectedUrlString3 = 'https://localhost:8082';
    const expectedUrl3 = vscode.Uri.parse(expectedUrlString3);
    assert.strictEqual(result.length, 3);
    assert.deepStrictEqual(result[0].url.toJSON(), expectedUrl1.toJSON());
    assert.strictEqual(result[0].start, 5);
    assert.strictEqual(result[0].length, expectedUrlString1.length);
    assert.deepStrictEqual(result[1].url.toJSON(), expectedUrl2.toJSON());
    assert.strictEqual(result[1].start, 28);
    assert.strictEqual(result[1].length, expectedUrlString2.length);
    assert.deepStrictEqual(result[2].url.toJSON(), expectedUrl3.toJSON());
    assert.strictEqual(result[2].start, 55);
    assert.strictEqual(result[2].length, expectedUrlString3.length);
  });

  it('should not include trailing brackets "()"', () => {
    const line = 'Check this link (http://localhost:8080/) for details';
    const result = extractHttpUrls(line);
    const expectedUrlString = 'http://localhost:8080/';
    const expectedUrl = vscode.Uri.parse(expectedUrlString);
    assert.strictEqual(result.length, 1);
    assert.deepStrictEqual(result[0].url.toJSON(), expectedUrl.toJSON());
    assert.strictEqual(result[0].start, 17);
    assert.strictEqual(result[0].length, expectedUrlString.length);
  });
});

describe('isLocalUrl', () => {
  it('should detect localhost', () => {
    const url1 = vscode.Uri.parse('http://localhost');
    const url2 = vscode.Uri.parse('http://127.0.0.1:8080/path');
    const url3 = vscode.Uri.parse('http://0.0.0.0');
    assert.strictEqual(isLocalUrl(url1), true);
    assert.strictEqual(isLocalUrl(url2), true);
    assert.strictEqual(isLocalUrl(url3), true);
  });
  it('should not detect remote hosts', () => {
    const url1 = vscode.Uri.parse('http://example.com');
    const url2 = vscode.Uri.parse('https://myhost');
    assert.strictEqual(isLocalUrl(url1), false);
    assert.strictEqual(isLocalUrl(url2), false);
  });
});

describe('convertUrl', () => {
  it('should convert uri with port', () => {
    const uriString = 'http://localhost:8080/path?query=1';
    const uri = vscode.Uri.parse(uriString);
    const newUri = convertUrl(uri, 'myhost');
    const expectedUriString = 'http://8080-myhost/path?query=1';
    const expectedUri = vscode.Uri.parse(expectedUriString);
    assert.deepStrictEqual(newUri.toJSON(), expectedUri.toJSON());
  });
  it('should convert uri without port', () => {
    const uriString = 'http://localhost/path';
    const uri = vscode.Uri.parse(uriString);
    const newUri = convertUrl(uri, 'myhost');
    const expectedUriString = 'http://myhost/path';
    const expectedUri = vscode.Uri.parse(expectedUriString);
    assert.deepStrictEqual(newUri.toJSON(), expectedUri.toJSON());
  });
});


