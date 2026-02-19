const { sendTikTokEvent } = require('../services/tiktok');
const crypto = require('crypto');

describe('TikTok Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.TIKTOK_ACCESS_TOKEN = 'test-access-token';
    process.env.TIKTOK_PIXEL_ID = 'test-pixel-id';

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ code: 0, message: 'OK' }),
      })
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should send a CompleteRegistration event with hashed user data', async () => {
    const userData = {
      email: 'test@example.com',
      phone: '1234567890',
      ip: '127.0.0.1',
      userAgent: 'TestAgent/1.0',
      eventId: 'unique-event-id'
    };

    await sendTikTokEvent(userData);

    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://business-api.tiktok.com/open_api/v1.3/pixel/track/');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      'Access-Token': 'test-access-token'
    });

    const body = JSON.parse(options.body);
    expect(body.pixel_code).toBe('test-pixel-id');
    expect(body.event).toBe('CompleteRegistration');
    expect(body.event_id).toBe('unique-event-id');
    expect(body.timestamp).toBeDefined();

    // Verify hashing
    // SHA256('test@example.com') = 973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b
    const expectedEmailHash = crypto.createHash('sha256').update('test@example.com').digest('hex');
    expect(body.context.user.email).toBe(expectedEmailHash);

    // SHA256('1234567890') = c775e7b757ede630cd0aa1113bd102661ab38829ca52a6422ab782862f268646
    const expectedPhoneHash = crypto.createHash('sha256').update('1234567890').digest('hex');
    expect(body.context.user.phone_number).toBe(expectedPhoneHash);

    expect(body.context.ip).toBe('127.0.0.1');
    expect(body.context.user_agent).toBe('TestAgent/1.0');
  });

  test('should skip tracking if env vars are missing', async () => {
    delete process.env.TIKTOK_ACCESS_TOKEN;
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await sendTikTokEvent({ email: 'test@example.com' });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('TikTok tracking skipped'));
    consoleSpy.mockRestore();
  });

  test('should handle missing optional fields', async () => {
    await sendTikTokEvent({ email: 'test@example.com' }); // No phone, ip, ua

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);

    expect(body.context.user.email).toBeDefined();
    expect(body.context.user.phone_number).toBeUndefined();
    expect(body.context.ip).toBeUndefined();
    expect(body.context.user_agent).toBeUndefined();
  });

  test('should handle API errors gracefully (fire and forget)', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid pixel code')
      })
    );
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await sendTikTokEvent({ email: 'test@example.com' });

    expect(global.fetch).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('TikTok tracking failed'), expect.any(String));
    consoleSpy.mockRestore();
  });
});
