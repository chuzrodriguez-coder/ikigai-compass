import { useState, useEffect } from "react";
import {
  useGetMe,
  useUpdateMe,
  useGetUserPreferences,
  useUpdateUserPreferences,
  getGetMeQueryKey,
  getGetUserPreferencesQueryKey,
  UpdateUserPreferencesBodyCoachingTone,
  UpdateUserPreferencesBodyCheckInFrequency,
} from "@workspace/api-client-react";

import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useClerk } from "@clerk/react";

type CoachingTone = (typeof UpdateUserPreferencesBodyCoachingTone)[keyof typeof UpdateUserPreferencesBodyCoachingTone];
type CheckInFrequency = (typeof UpdateUserPreferencesBodyCheckInFrequency)[keyof typeof UpdateUserPreferencesBodyCheckInFrequency];

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { signOut } = useClerk();

  const { data: user, isLoading: loadingUser } = useGetMe();
  const { data: prefs, isLoading: loadingPrefs } = useGetUserPreferences();
  const updateMe = useUpdateMe();
  const updatePrefs = useUpdateUserPreferences();

  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [coachingTone, setCoachingTone] = useState<CoachingTone>(UpdateUserPreferencesBodyCoachingTone.supportive);
  const [checkInFrequency, setCheckInFrequency] = useState<CheckInFrequency>(UpdateUserPreferencesBodyCheckInFrequency.weekly);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? "");
      setTimezone(user.timezone ?? "UTC");
    }
  }, [user]);

  useEffect(() => {
    if (prefs) {
      setCoachingTone((prefs.coachingTone ?? UpdateUserPreferencesBodyCoachingTone.supportive) as CoachingTone);
      setCheckInFrequency((prefs.checkInFrequency ?? UpdateUserPreferencesBodyCheckInFrequency.weekly) as CheckInFrequency);
      setAiEnabled(prefs.aiEnabled ?? true);
      setNotificationsEnabled(prefs.notificationsEnabled ?? true);
    }
  }, [prefs]);

  const handleSave = async () => {
    try {
      await updateMe.mutateAsync({ data: { displayName, timezone } });
      await updatePrefs.mutateAsync({
        data: { coachingTone, checkInFrequency, aiEnabled, notificationsEnabled },
      });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetUserPreferencesQueryKey() });
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Error", description: "Could not save settings", variant: "destructive" });
    }
  };

  if (loadingUser || loadingPrefs) {
    return (
      <MainLayout>
        <div className="max-w-xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-serif font-semibold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">Customize how Ikigai Compass works for you.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                data-testid="input-display-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="timezone" data-testid="select-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  <SelectItem value="Europe/London">London</SelectItem>
                  <SelectItem value="Europe/Paris">Paris / Berlin</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  <SelectItem value="Asia/Singapore">Singapore</SelectItem>
                  <SelectItem value="Australia/Sydney">Sydney</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coaching preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coaching-tone">Coaching tone</Label>
              <Select value={coachingTone} onValueChange={(v) => setCoachingTone(v as CoachingTone)}>
                <SelectTrigger id="coaching-tone" data-testid="select-coaching-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supportive">Supportive — warm, encouraging</SelectItem>
                  <SelectItem value="direct">Direct — clear, no-nonsense</SelectItem>
                  <SelectItem value="challenging">Challenging — push me harder</SelectItem>
                  <SelectItem value="gentle">Gentle — patient, compassionate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkin-frequency">Check-in frequency</Label>
              <Select value={checkInFrequency} onValueChange={(v) => setCheckInFrequency(v as CheckInFrequency)}>
                <SelectTrigger id="checkin-frequency" data-testid="select-checkin-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">AI coaching</p>
                <p className="text-xs text-muted-foreground">Enable AI-powered coaching and synthesis</p>
              </div>
              <Switch
                checked={aiEnabled}
                onCheckedChange={setAiEnabled}
                data-testid="switch-ai-enabled"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Notifications</p>
                <p className="text-xs text-muted-foreground">Check-in reminders and milestone alerts</p>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
                data-testid="switch-notifications"
              />
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full"
          onClick={handleSave}
          disabled={updateMe.isPending || updatePrefs.isPending}
          data-testid="button-save-settings"
        >
          {updateMe.isPending || updatePrefs.isPending ? "Saving..." : "Save settings"}
        </Button>

        <Card className="border-destructive/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Sign out</p>
                <p className="text-xs text-muted-foreground">Sign out of your account</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut()}
                data-testid="button-sign-out"
              >
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
