import { describe, it, expect, beforeEach } from 'vitest';
import { db, INITIAL_USERS } from '../services/storage';
import { SnackItem, PricingConfig } from '../types';

describe('Snacks & Pricing Cloud Synchronization & Zero Reversion Test Suite', () => {
  const admin = INITIAL_USERS[0]; // Ruwaidh Admin

  beforeEach(() => {
    db.resetToDemoData();
  });

  describe('1. Snack Inventory & Catalogue Persistence', () => {
    it('creates a new snack and persists it without being overwritten', () => {
      const initialCount = db.getSnacks().length;
      const newSnack = db.createSnack(
        {
          name: 'Monster Mango Loco (350ml)',
          category: 'Beverages',
          pricePaise: 13500, // ₹135
          isActive: true,
          stock: 45,
          lowStockThreshold: 10,
        },
        admin
      );

      expect(newSnack.id).toBeDefined();
      expect(newSnack.name).toBe('Monster Mango Loco (350ml)');

      const snacks = db.getSnacks();
      expect(snacks.length).toBe(initialCount + 1);
      const found = snacks.find((s) => s.id === newSnack.id);
      expect(found).toBeDefined();
      expect(found?.pricePaise).toBe(13500);
      expect(found?.stock).toBe(45);
    });

    it('updates an existing snack price and stock accurately', () => {
      const snacks = db.getSnacks();
      const firstSnack = snacks[0]; // Miranda

      const updated = db.updateSnack(
        firstSnack.id,
        {
          name: 'Miranda (Updated 300ml)',
          pricePaise: 2500, // ₹25
          stock: 80,
          lowStockThreshold: 8,
        },
        admin
      );

      expect(updated.pricePaise).toBe(2500);
      expect(updated.stock).toBe(80);

      const refreshed = db.getSnacks().find((s) => s.id === firstSnack.id);
      expect(refreshed?.pricePaise).toBe(2500);
      expect(refreshed?.name).toBe('Miranda (Updated 300ml)');
      expect(refreshed?.stock).toBe(80);
    });

    it('PERMANENTLY preserves out-of-stock items (stock: 0) without resetting to 50 on restart', () => {
      const snacks = db.getSnacks();
      const firstSnack = snacks[0];

      // Client marks item out of stock
      db.updateSnack(firstSnack.id, { stock: 0 }, admin);

      const afterUpdate = db.getSnacks().find((s) => s.id === firstSnack.id);
      expect(afterUpdate?.stock).toBe(0);

      // Simulate system re-initialization (e.g. next morning reload)
      db.init();

      const afterMorningInit = db.getSnacks().find((s) => s.id === firstSnack.id);
      // MUST NOT BE RESET TO 50!
      expect(afterMorningInit?.stock).toBe(0);
    });

    it('deletes a snack and verifies it is removed from catalogue', () => {
      const snacks = db.getSnacks();
      const target = snacks[snacks.length - 1];

      db.deleteSnack(target.id, admin);

      const remaining = db.getSnacks();
      expect(remaining.some((s) => s.id === target.id)).toBe(false);
    });
  });

  describe('2. Pricing Configuration Persistence', () => {
    it('updates PS5 and Snooker rates and preserves them without reverting to default', () => {
      const initial = db.getPricingConfig();
      expect(initial.businessName).toBeDefined();

      const updated = db.updatePricingConfig(
        {
          businessName: 'Vault Gaming & Lounge (Custom)',
          ps5HourlyRatePaise: 18000, // ₹180
          ps5Rate1PlayerPaise: 18000,
          ps5MultiplayerHourlyRatePaise: 32000, // ₹320
          snookerHourlyRatePaise: 28000, // ₹280
          poolHourlyRatePaise: 28000,
          roundingRule: 'exact',
          graceMinutes: 10,
        },
        admin
      );

      expect(updated.ps5HourlyRatePaise).toBe(18000);
      expect(updated.businessName).toBe('Vault Gaming & Lounge (Custom)');

      // Verify retrieval from storage
      const fetched = db.getPricingConfig();
      expect(fetched.ps5HourlyRatePaise).toBe(18000);
      expect(fetched.ps5MultiplayerHourlyRatePaise).toBe(32000);
      expect(fetched.snookerHourlyRatePaise).toBe(28000);
      expect(fetched.roundingRule).toBe('exact');
      expect(fetched.graceMinutes).toBe(10);

      // Verify persistence across init
      db.init();
      const afterInit = db.getPricingConfig();
      expect(afterInit.ps5HourlyRatePaise).toBe(18000);
      expect(afterInit.businessName).toBe('Vault Gaming & Lounge (Custom)');
    });
  });

  describe('3. Two-Way Cloud Synchronization Helpers', () => {
    it('supports setSnacks and setPricingConfig for remote reconciliation', () => {
      const customSnacks: SnackItem[] = [
        {
          id: 'snk-custom-cloud',
          name: 'Cloud Exclusive Iced Tea',
          category: 'Beverages',
          pricePaise: 6000,
          isActive: true,
          stock: 30,
          lowStockThreshold: 5,
        },
      ];

      db.setSnacks(customSnacks);
      expect(db.getSnacks().length).toBe(1);
      expect(db.getSnacks()[0].name).toBe('Cloud Exclusive Iced Tea');

      const customPricing: PricingConfig = {
        ...db.getPricingConfig(),
        businessName: 'Cloud Vault 147',
        ps5HourlyRatePaise: 20000,
      };

      db.setPricingConfig(customPricing);
      expect(db.getPricingConfig().businessName).toBe('Cloud Vault 147');
      expect(db.getPricingConfig().ps5HourlyRatePaise).toBe(20000);
    });
  });
});

