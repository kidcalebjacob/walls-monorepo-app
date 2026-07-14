export type TeamMemberFormData = {
  firstName: string;
  lastName: string;
  email: string;
  personalEmail: string;
  phoneNumber: string;
  profilePicture: File | null;
  title: string;
  linkedinUrl: string;
};

export const initialTeamMemberFormData: TeamMemberFormData = {
  firstName: "",
  lastName: "",
  email: "",
  personalEmail: "",
  phoneNumber: "",
  profilePicture: null,
  title: "",
  linkedinUrl: "",
};
