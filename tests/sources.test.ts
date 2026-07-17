import { describe, expect, it } from 'vitest';
import { parseEpicResponse, parseGogResponse, parseSteamResponse } from '../src/sources/index.js';

const now = new Date('2026-07-17T12:00:00Z');

describe('store sources', () => {
  it('normalizes a paid Steam game discounted by 100%', () => {
    const html = `<a href="https://store.steampowered.com/app/123/Game/?snr=x" data-ds-appid="123"><div class="search_capsule"><img src="https://img.test/game.jpg"></div><span class="title">Game &amp; Fun</span><div data-discount="100"><div class="discount_original_price">19,99€</div></div></a>`;
    expect(
      parseSteamResponse({ success: 1, results_html: html, total_count: 1 }, now),
    ).toMatchObject([
      {
        externalId: '123',
        title: 'Game & Fun',
        store: 'steam',
        originalPrice: 19.99,
        currency: 'EUR',
      },
    ]);
  });

  it.each(['Demo', 'DLC', 'Soundtrack', 'Prologue', 'Free Weekend'])(
    'filters Steam %s content',
    (suffix) => {
      const html = `<a href="https://store.steampowered.com/app/1/x" data-ds-appid="1"><span class="title">Game ${suffix}</span><div data-discount="100"><div class="discount_original_price">10€</div></div></a>`;
      expect(parseSteamResponse({ success: 1, results_html: html, total_count: 1 })).toEqual([]);
    },
  );

  it('normalizes only an active Epic base-game giveaway', () => {
    const response = epicFixture();
    expect(parseEpicResponse(response, now)).toMatchObject([
      {
        externalId: 'epic-id',
        store: 'epic',
        originalPrice: 29.99,
        currency: 'EUR',
        title: 'Epic Game',
      },
    ]);
  });

  it('excludes an expired Epic promotion', () => {
    const response = epicFixture();
    response.data.Catalog.searchStore.elements[0]!.promotions.promotionalOffers[0]!.promotionalOffers[0]!.endDate =
      '2026-07-16T00:00:00Z';
    expect(parseEpicResponse(response, now)).toEqual([]);
  });

  it('normalizes a GOG 100% discount and excludes permanent free games and DLC', () => {
    const product = gogProduct();
    const permanent = {
      ...gogProduct(),
      id: '2',
      price: { ...gogProduct().price, baseMoney: { amount: '0', currency: 'EUR' } },
    };
    const dlc = { ...gogProduct(), id: '3', productType: 'dlc' };
    expect(parseGogResponse({ products: [product, permanent, dlc] })).toMatchObject([
      { externalId: 'gog-id', store: 'gog', originalPrice: 9.99, title: 'GOG Game' },
    ]);
  });
});

function epicFixture() {
  return {
    data: {
      Catalog: {
        searchStore: {
          elements: [
            {
              id: 'epic-id',
              title: 'Epic Game',
              description: 'Description',
              offerType: 'BASE_GAME',
              productSlug: null,
              urlSlug: 'fallback',
              keyImages: [{ type: 'OfferImageWide', url: 'https://img.test/epic.jpg' }],
              categories: [{ path: 'games' }],
              catalogNs: { mappings: [{ pageSlug: 'epic-game', pageType: 'productHome' }] },
              price: {
                totalPrice: {
                  originalPrice: 2999,
                  discountPrice: 0,
                  currencyCode: 'EUR',
                  currencyInfo: { decimals: 2 },
                },
              },
              promotions: {
                promotionalOffers: [
                  {
                    promotionalOffers: [
                      {
                        startDate: '2026-07-16T00:00:00Z',
                        endDate: '2026-07-20T00:00:00Z',
                        discountSetting: { discountPercentage: 0 },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
    },
  };
}

function gogProduct() {
  return {
    id: 'gog-id',
    slug: 'gog_game',
    productType: 'game',
    title: 'GOG Game',
    coverHorizontal: 'https://img.test/gog.jpg',
    storeLink: 'https://www.gog.com/en/game/gog_game',
    tags: [],
    price: {
      finalMoney: { amount: '0.00', currency: 'EUR' },
      baseMoney: { amount: '9.99', currency: 'EUR' },
      discount: '-100%',
    },
  };
}
