import { Notification } from '../models/Notification.js';

export const createNotification = async ({
  recipient,
  type,
  title,
  message,
  link = '',
  relatedResource = {}
}) => {
  try {
    const notification = await Notification.create({
      recipient,
      type,
      title,
      message,
      link,
      relatedResource
    });
    return notification;
  } catch (error) {
    console.error('[Notification Service] Failed to create notification:', error.message);
    return null;
  }
};
