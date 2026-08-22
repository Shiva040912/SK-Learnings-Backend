import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  Settings,
  SettingsDocument,
} from './settings.schema';

import { UpdateSettingsDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings.name)
    private readonly settingsModel:
      Model<SettingsDocument>,
  ) {}

  private async getOrCreateSettings() {
    let settings =
      await this.settingsModel.findOne();

    if (!settings) {
      settings =
        new this.settingsModel({});

      await settings.save();
    }

    return settings;
  }

  async getSettings() {
    return this.getOrCreateSettings();
  }

  async updateSettings(
    updateSettingsDto:
      UpdateSettingsDto,
  ) {
    const settings =
      await this.getOrCreateSettings();

    const defaultMonths =
      updateSettingsDto.defaultMonths ??
      settings.defaultMonths;

    if (
      !Number.isInteger(
        Number(defaultMonths),
      ) ||
      Number(defaultMonths) < 1
    ) {
      throw new BadRequestException(
        'Default months must be a positive whole number',
      );
    }

    const recurringFeeStartDay =
      updateSettingsDto.recurringFeeStartDay ??
      settings.recurringFeeStartDay ??
      1;

    const recurringFeeDueDay =
      updateSettingsDto.recurringFeeDueDay ??
      settings.recurringFeeDueDay ??
      10;

    if (
      !Number.isInteger(
        Number(
          recurringFeeStartDay,
        ),
      ) ||
      Number(
        recurringFeeStartDay,
      ) < 1 ||
      Number(
        recurringFeeStartDay,
      ) > 31
    ) {
      throw new BadRequestException(
        'Recurring fee start day must be between 1 and 31',
      );
    }

    if (
      !Number.isInteger(
        Number(
          recurringFeeDueDay,
        ),
      ) ||
      Number(
        recurringFeeDueDay,
      ) < 1 ||
      Number(
        recurringFeeDueDay,
      ) > 31
    ) {
      throw new BadRequestException(
        'Recurring fee due day must be between 1 and 31',
      );
    }

    const cleanData =
      Object.fromEntries(
        Object.entries(
          updateSettingsDto,
        ).filter(
          ([, value]) =>
            value !== undefined,
        ),
      );

    Object.assign(
      settings,
      cleanData,
    );

    await settings.save();

    return {
      message:
        'Settings updated successfully',
      settings,
    };
  }

  async getFeeSettings() {
    const settings =
      await this.getOrCreateSettings();

    return {
      monthlyFeeEnabled:
        settings.monthlyFeeEnabled,

      defaultMonths:
        settings.defaultMonths,

      /*
       * Legacy fields are returned so older frontend builds
       * do not break, but they are not hard limits anymore.
       */
      minimumMonths:
        settings.minimumMonths,

      maximumMonths:
        settings.maximumMonths,

      partialFeeEnabled:
        settings.partialFeeEnabled,

      minimumPartialAmount:
        settings.minimumPartialAmount,

      yearlyFeeEnabled:
        settings.yearlyFeeEnabled,

      commonFeeSetupEnabled:
        settings.commonFeeSetupEnabled ??
        true,

      courseWiseFeeSetupEnabled:
        settings.courseWiseFeeSetupEnabled ??
        true,

      recurringFeeStartDay:
        settings.recurringFeeStartDay ??
        1,

      recurringFeeDueDay:
        settings.recurringFeeDueDay ??
        10,
    };
  }

  async getNotificationSettings() {
    const settings =
      await this.getOrCreateSettings();

    return {
      whatsappEnabled:
        settings.whatsappEnabled,

      reminderDaysBeforeDue:
        settings.reminderDaysBeforeDue,

      reminderOnDueDate:
        settings.reminderOnDueDate,

      overdueReminderEnabled:
        settings.overdueReminderEnabled,

      overdueReminderIntervalDays:
        settings.overdueReminderIntervalDays,
    };
  }

  async getInvoiceSettings() {
    const settings =
      await this.getOrCreateSettings();

    return {
      invoiceEnabled:
        settings.invoiceEnabled,

      invoicePrefix:
        settings.invoicePrefix,

      invoiceSuffix:
        settings.invoiceSuffix,

      invoiceQrCode:
        settings.invoiceQrCode,

      gstNumber:
        settings.gstNumber,

      ownerName:
        settings.ownerName,

      invoiceAddress:
        settings.invoiceAddress,

      invoiceFooter:
        settings.invoiceFooter,

      invoiceTerms:
        settings.invoiceTerms,
    };
  }
}
