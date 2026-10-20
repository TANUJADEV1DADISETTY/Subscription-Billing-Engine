// infrastructure/adapters/SystemTimeProvider.ts
import { ITimeProvider } from '../../domain/ports/ITimeProvider';

export class SystemTimeProvider implements ITimeProvider {
  // Real implementation of the clock
  getCurrentTime(): Date {
    return new Date();
  }
}
