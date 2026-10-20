// infrastructure/adapters/MockPaymentGateway.ts
import { IPaymentGateway } from '../../domain/ports/IPaymentGateway';

export interface ChargeAttempt {
  customerId: string;
  amount: number;
  timestamp: Date;
}

export class MockPaymentGateway implements IPaymentGateway {
  private shouldSucceed: boolean;
  private shouldThrow: boolean;
  public chargeHistory: ChargeAttempt[] = [];

  constructor(shouldSucceed = true, shouldThrow = false) {
    this.shouldSucceed = shouldSucceed;
    this.shouldThrow = shouldThrow;
  }

  setShouldSucceed(value: boolean): void {
    this.shouldSucceed = value;
  }

  setShouldThrow(value: boolean): void {
    this.shouldThrow = value;
  }

  async charge(customerId: string, amount: number): Promise<boolean> {
    this.chargeHistory.push({
      customerId,
      amount,
      timestamp: new Date()
    });

    if (this.shouldThrow) {
      throw new Error('Payment gateway network timeout');
    }

    return this.shouldSucceed;
  }
}
