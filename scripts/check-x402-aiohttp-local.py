"""Test generated seller challenges with an unmodified aiohttp parser, offline.

Only listens/connects to a newly created IPv4 loopback socket. Never reads
wallets, environment credentials, external URLs or payment authorizations.
"""
import asyncio
import json
import sys
import aiohttp


async def exercise(header, rejected=False):
    async def serve(reader, writer):
        try:
            await reader.readuntil(b"\r\n\r\n")
            writer.write(b"HTTP/1.1 402 Payment Required\r\nPAYMENT-REQUIRED: "
                         + header.encode("ascii")
                         + b"\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}")
            await writer.drain()
        finally:
            writer.close()
            await writer.wait_closed()

    server = await asyncio.start_server(serve, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    try:
        async with server, aiohttp.ClientSession(
            trust_env=False, cookie_jar=aiohttp.DummyCookieJar(),
            timeout=aiohttp.ClientTimeout(total=5)
        ) as session:
            try:
                async with session.get(f"http://127.0.0.1:{port}/", allow_redirects=False) as response:
                    assert not rejected, "oversized negative control unexpectedly parsed"
                    assert response.status == 402
                    assert response.headers["PAYMENT-REQUIRED"] == header
                    assert await response.json() == {}
            except aiohttp.ClientResponseError as error:
                assert rejected, str(error)
                assert "8190" in str(error), str(error)
    finally:
        server.close()
        await server.wait_closed()


async def main():
    fixtures = json.load(sys.stdin)
    for fixture in fixtures:
        assert isinstance(fixture["header"], str)
        await exercise(fixture["header"])
    await exercise("A" * 11252, rejected=True)
    print(json.dumps({"aiohttpVersion": aiohttp.__version__, "loopbackOnly": True,
                      "defaultParserUsed": True, "acceptedChallenges": len(fixtures),
                      "reported11252ByteNegativeControlRejected": True,
                      "maximumHeaderValueBytes": max(len(f["header"]) for f in fixtures),
                      "paidCalls": 0}))


if __name__ == "__main__":
    asyncio.run(main())
