import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { Plus, Trash } from "lucide-react";
import { useState } from "react";
import {
  useUpdateHealth,
  useUpdateSingleMonitor,
} from "@blocks-deployment/hooks/alerts";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { ErrorTransformer } from "@/lib/error-transform";
import { z } from "zod";

type NotificationProviderProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  request: boolean;
  data: INotificationProps;
};
type INotificationProps = {
  repoName?: string;
  itemId: string;
  name?: string;
  isActive: boolean;
  emails?: string[];
  repoId?: string;
  projectKey: string;
};

const NotificationModal = ({
  open,
  onOpenChange,
  data,
  request,
}: NotificationProviderProps) => {
  const updateMutation = useUpdateSingleMonitor();
  const updateHealth = useUpdateHealth();
  const [emailList, setEmailList] = useState<string[]>(data.emails || []);
  const [emailErrors, setEmailErrors] = useState<{ [key: number]: string }>({});
  const MAX_EMAILS = 5;
  const emailSchema = z.string().email("Please enter a valid email address");
  const isValidEmail = (email: string): boolean => {
    const result = emailSchema.safeParse(email);
    return result.success;
  };

  const getEmailError = (email: string): string | null => {
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      return (
        result.error.errors[0]?.message || "Please enter a valid email address"
      );
    }
    return null;
  };

  const addEmail = () => {
    if (emailList.length >= MAX_EMAILS) {
      return;
    }
    setEmailList([...emailList, ""]);
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emailList];
    newEmails[index] = value;
    setEmailList(newEmails);

    const newErrors = { ...emailErrors };

    if (!value.trim()) {
      newErrors[index] = "Email is required";
    } else if (!isValidEmail(value)) {
      const zodError = getEmailError(value);
      newErrors[index] = zodError || "Please enter a valid email address";
    } else {
      delete newErrors[index];
    }

    setEmailErrors(newErrors);
  };

  const removeEmail = (index: number) => {
    const newEmails = emailList.filter((_, i) => i !== index);
    setEmailList(newEmails);
    const newErrors = { ...emailErrors };
    delete newErrors[index];
    const reindexedErrors: { [key: number]: string } = {};
    Object.keys(newErrors).forEach((key) => {
      const keyNum = parseInt(key);
      if (keyNum > index) {
        reindexedErrors[keyNum - 1] = newErrors[keyNum];
      } else {
        reindexedErrors[keyNum] = newErrors[keyNum];
      }
    });
    setEmailErrors(reindexedErrors);
  };

  const handleEditClick = () => {
    const hasErrors = validateAllEmails();
    if (hasErrors) {
      return;
    }
    handleSave();
    if (emailList.length === 0) {
      setEmailList([""]);
    }
  };

  const validateAllEmails = (): boolean => {
    const newErrors: { [key: number]: string } = {};
    let hasErrors = false;
    const emailMap = new Map<string, number[]>();
    emailList.forEach((email, index) => {
      const trimmedEmail = email.trim().toLowerCase();
      if (!email.trim()) {
        newErrors[index] = "Email is required";
        hasErrors = true;
      } else if (!isValidEmail(email)) {
        const zodError = getEmailError(email);
        newErrors[index] = zodError || "Please enter a valid email address";
        hasErrors = true;
      } else {
        if (!emailMap.has(trimmedEmail)) {
          emailMap.set(trimmedEmail, []);
        }
        emailMap.get(trimmedEmail)!.push(index);
      }
    });
    emailMap.forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach((index) => {
          newErrors[index] = "This email is already added";
          hasErrors = true;
        });
      }
    });
    setEmailErrors(newErrors);
    return hasErrors;
  };

  const handleSave = async () => {
    try {
      const validEmails = emailList.filter((email) => email.trim() !== "");
      if (validEmails.length === 0) {
        showErrorToast({ errors: "Please add at least one email address" });
        return;
      }
      const payload = {
        itemId: data.itemId || "",
        isActive: data.isActive || false,
        emails: validEmails,
      };
      let res;
      if (request) {
        res = await updateMutation.mutateAsync(payload);
      } else {
        res = await updateHealth.mutateAsync({
          ...payload,
          projectKey: data?.projectKey,
          name: data.name,
        });
      }
      if (!res.isSuccess) return showErrorToast({ errors: res.message });
      showSuccessToast({
        description: data.itemId
          ? "Monitor successfully updated."
          : "Monitor successfully created.",
      });
      setEmailErrors({});
      onOpenChange(false);
    } catch (error) {
      return showErrorToast({ errors: ErrorTransformer(error) });
    }
  };

  const handleCancel = () => {
    setEmailList(data.emails || []);
    setEmailErrors({});
    onOpenChange(false);
  };
  const hasValidEmail = (): boolean => {
    return emailList.some(
      (email) => email.trim() && isValidEmail(email.trim()),
    );
  };
  const isSaveDisabled = (): boolean => {
    const hasErrors = Object.keys(emailErrors).length > 0;
    return updateMutation.isPending || hasErrors || !hasValidEmail();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-screen-sm">
        <DialogHeader>
          <DialogTitle>Notification settings</DialogTitle>
        </DialogHeader>

        <div>
          <div>
            <p className="mb-3 text-sm font-medium">Recipients</p>
            <div className="flex flex-col items-start justify-center gap-3">
              {emailList.map((item, index) => (
                <div key={index} className="flex w-full flex-col gap-1">
                  <div className="flex w-full items-center gap-2">
                    <div className="flex flex-1 flex-col">
                      <input
                        type="email"
                        className={`w-full rounded border px-3 py-2 focus:outline-none focus:ring ${
                          emailErrors[index]
                            ? "border-red-500 focus:ring-red-200"
                            : "focus:ring-blue-200"
                        }`}
                        placeholder="Enter email address"
                        value={item}
                        onChange={(e) => updateEmail(index, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (!emailErrors[index] && item.trim()) {
                              addEmail();
                            }
                          }
                        }}
                      />
                      {emailErrors[index] && (
                        <span className="mt-1 text-xs text-red-500">
                          {emailErrors[index]}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeEmail(index)}
                      className="h-fit w-fit p-1">
                      <Trash className="h-4 w-4 text-error" />
                    </Button>
                  </div>
                </div>
              ))}
              {emailList.length < MAX_EMAILS && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addEmail}
                  className="mt-2 self-start">
                  <Plus className="mr-2 h-4 w-4" />
                  Add email
                </Button>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant={"outline"} onClick={handleCancel}>
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleEditClick}
              disabled={isSaveDisabled()}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationModal;
