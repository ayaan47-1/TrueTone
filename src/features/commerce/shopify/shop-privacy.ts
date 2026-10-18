let accepted = false;

export const hasAcceptedShopPrivacy = (): boolean => accepted;
export const acceptShopPrivacy = (): void => {
  accepted = true;
};
export const __resetShopPrivacyForTests = (): void => {
  accepted = false;
};
