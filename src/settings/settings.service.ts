import { Injectable } from '@nestjs/common';
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

    if (
      updateSettingsDto.minimumMonths !==
        undefined &&
      updateSettingsDto.maximumMonths !==
        undefined &&
      updateSettingsDto.minimumMonths >
        updateSettingsDto.maximumMonths
    ) {
      throw new Error(
        'Minimum months cannot be greater than maximum months',
      );
    }

    const minimumMonths =
      updateSettingsDto.minimumMonths ??
      settings.minimumMonths;

    const maximumMonths =
      updateSettingsDto.maximumMonths ??
      settings.maximumMonths;

    const defaultMonths =
      updateSettingsDto.defaultMonths ??
      settings.defaultMonths;

    if (
      defaultMonths < minimumMonths ||
      defaultMonths > maximumMonths
    ) {
      throw new Error(
        `Default months must be between ${minimumMonths} and ${maximumMonths}`,
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