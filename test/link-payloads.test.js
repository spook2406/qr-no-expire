'use strict';

// Link-based generators: Google review, Discord, Meet, Zoom, Teams,
// Telegram, Spotify, Google Form. Each normalizes an allowed host, strips
// tracking parameters, and rejects anything else.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadIIFE } = require('./helpers');

const Review = loadIIFE('js/review-link.js').ReviewLink;
const Discord = loadIIFE('js/discord-payload.js').DiscordPayload;
const Meet = loadIIFE('js/meet-payload.js').MeetPayload;
const Zoom = loadIIFE('js/zoom-payload.js').ZoomPayload;
const Teams = loadIIFE('js/teams-payload.js').TeamsPayload;
const Telegram = loadIIFE('js/telegram-payload.js').TelegramPayload;
const Spotify = loadIIFE('js/spotify-payload.js').SpotifyPayload;
const GoogleForm = loadIIFE('js/google-form-payload.js').GoogleFormPayload;

test('review: Place ID becomes the write-review URL', () => {
  const built = Review.normalizeReviewLink('ChIJN1t_tDeuEmsRUsoyG83frY4');
  assert.equal(built.url, 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4');
  assert.equal(built.kind, 'placeid');
});

test('review: official g.page review link is kept; other hosts rejected', () => {
  assert.equal(Review.normalizeReviewLink('https://g.page/r/CabcdEF123/review').url, 'https://g.page/r/CabcdEF123/review');
  assert.throws(() => Review.normalizeReviewLink('https://evil.com/x'), /not a Google URL/);
});

test('discord: invite links normalize to discord.gg and drop tracking', () => {
  const a = Discord.buildDiscordPayload('https://discord.gg/abcDEF12?utm_source=x');
  assert.equal(a.payload, 'https://discord.gg/abcDEF12');
  assert.equal(a.strippedTracking, true);
  assert.equal(Discord.buildDiscordPayload('discord.com/invite/abcDEF12').payload, 'https://discord.gg/abcDEF12');
});

test('discord: channel deep links are rejected', () => {
  assert.throws(() => Discord.buildDiscordPayload('https://discord.com/channels/1/2'), /invite/);
});

test('meet: URL and bare code both give the canonical join link', () => {
  assert.equal(Meet.buildMeetPayload('https://meet.google.com/abc-defg-hij?authuser=1').payload, 'https://meet.google.com/abc-defg-hij');
  assert.equal(Meet.buildMeetPayload('abcdefghij').payload, 'https://meet.google.com/abc-defg-hij');
  assert.throws(() => Meet.buildMeetPayload('https://zoom.us/j/1'), /Google Meet/);
});

test('zoom: keeps pwd, strips tracking, warns about the password', () => {
  const built = Zoom.buildZoomPayload('https://us02web.zoom.us/j/85012345678?pwd=AbC123.1&utm_source=x');
  assert.equal(built.payload, 'https://us02web.zoom.us/j/85012345678?pwd=AbC123.1');
  assert.equal(built.hasPwd, true);
  assert.equal(built.strippedTracking, true);
  assert.match(built.warning, /password/);
});

test('zoom: bare IDs and non-Zoom hosts are rejected', () => {
  assert.throws(() => Zoom.buildZoomPayload('850 1234 5678'), /zoom\.us/);
  assert.throws(() => Zoom.buildZoomPayload('https://evil.com/j/123'), /not a Zoom/);
});

test('teams: meetup-join URL keeps context, drops tracking', () => {
  const built = Teams.buildTeamsPayload('https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%7d&utm_source=x');
  assert.equal(built.payload, 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7B%7D');
  assert.equal(built.strippedTracking, true);
});

test('teams: non-join pages and other hosts are rejected', () => {
  assert.throws(() => Teams.buildTeamsPayload('https://teams.microsoft.com/meet/1234567890?p=abcd'), /meetup-join/);
  assert.throws(() => Teams.buildTeamsPayload('https://example.com/'), /not a Microsoft Teams/);
});

test('telegram: @username, t.me URL, and invite links', () => {
  assert.equal(Telegram.buildTelegramPayload('@durov').payload, 'https://t.me/durov');
  const url = Telegram.buildTelegramPayload('https://t.me/durov?utm_source=x');
  assert.equal(url.payload, 'https://t.me/durov');
  assert.equal(url.strippedTracking, true);
  assert.equal(Telegram.buildTelegramPayload('https://t.me/+AbCdEfGhIjKlMnOp').payload, 'https://t.me/+AbCdEfGhIjKlMnOp');
});

test('telegram: login links are rejected', () => {
  assert.throws(() => Telegram.buildTelegramPayload('https://t.me/login/123'), /login/);
});

test('spotify: drops intl segment and si tracking', () => {
  const built = Spotify.buildSpotifyPayload('https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC?si=abc');
  assert.equal(built.payload, 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC');
  assert.equal(built.type, 'track');
  assert.equal(built.strippedTracking, true);
});

test('spotify: URIs and other hosts are rejected', () => {
  assert.throws(() => Spotify.buildSpotifyPayload('spotify:album:4uLU6hMCjMI75M1A2tKUQC'), /valid URL/);
  assert.throws(() => Spotify.buildSpotifyPayload('https://example.com/track/1'), /open\.spotify\.com/);
});

test('google form: responder and forms.gle links are kept', () => {
  const long = 'https://docs.google.com/forms/d/e/1FAIpQLSabc123/viewform?usp=sf_link';
  assert.equal(GoogleForm.buildGoogleFormPayload(long).payload, long);
  assert.equal(GoogleForm.buildGoogleFormPayload('https://forms.gle/AbCdEf123').payload, 'https://forms.gle/AbCdEf123');
});

test('google form: /u/N/ account prefix is stripped', () => {
  const built = GoogleForm.buildGoogleFormPayload('https://docs.google.com/forms/u/0/d/e/1FAIpQLSabc123/viewform');
  assert.equal(built.payload, 'https://docs.google.com/forms/d/e/1FAIpQLSabc123/viewform');
  assert.equal(built.strippedUserPrefix, true);
});

test('google form: edit links are rejected', () => {
  assert.throws(() => GoogleForm.buildGoogleFormPayload('https://docs.google.com/forms/d/1abcDEF/edit'), /edit link/);
});
