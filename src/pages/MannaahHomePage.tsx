import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { ArrowRight, HeartHandshake, ShieldCheck, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAppContext } from '@/hooks/useAppContext';

export function MannaahHomePage() {
  const { config } = useAppContext();

  useSeoMeta({
    title: `Mannaah | Help doesn't ask where you're from`,
    description:
      'Direct humanitarian assistance through Bitcoin. Give directly to people who need help, without borders.',
  });

  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-[#f5efe3]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(214,164,83,0.22),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(91,119,91,0.16),transparent_45%)]" />

        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28 lg:py-36">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#c9b99d] bg-white/70 px-4 py-2 text-sm font-medium text-[#4b5d4d]">
              <HeartHandshake className="size-4" />
              Humanitarian aid without borders
            </div>

            <h1 className="text-5xl font-black tracking-tight text-[#354438] sm:text-6xl lg:text-8xl">
              Help doesn't ask
              <span className="block text-[#b47b35]">where you're from.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#596258] sm:text-xl">
              Mannaah connects people who need help with people willing to give
              it. Bitcoin lets assistance move directly, across borders and
              without requiring permission.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[#b47b35] px-7 text-white hover:bg-[#986629]"
              >
                <Link to="/campaigns">
                  Find someone to help
                  <ArrowRight className="ml-2 size-5" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-[#718071] px-7 text-[#354438]"
              >
                <Link to="/create">
                  Ask for help
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-[#d8ccb9] bg-[#fcfaf6] shadow-sm">
            <CardContent className="p-7">
              <Zap className="mb-5 size-8 text-[#b47b35]" />
              <h2 className="text-xl font-bold text-[#354438]">
                Direct Bitcoin
              </h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                Donations can move directly to the Bitcoin destination chosen
                by the campaign creator. Mannaah does not take custody of
                campaign funds.
              </p>
            </CardContent>
          </Card>

          <Card className="border-[#d8ccb9] bg-[#fcfaf6] shadow-sm">
            <CardContent className="p-7">
              <ShieldCheck className="mb-5 size-8 text-[#607563]" />
              <h2 className="text-xl font-bold text-[#354438]">
                Privacy by design
              </h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                People asking for help should not have to expose unnecessary
                personal information simply to receive assistance.
              </p>
            </CardContent>
          </Card>

          <Card className="border-[#d8ccb9] bg-[#fcfaf6] shadow-sm">
            <HeartHandshake className="mb-5 size-8 text-[#b47b35]" />
            <CardContent className="p-0 px-7 pb-7">
              <h2 className="text-xl font-bold text-[#354438]">
                You don't have to walk alone
              </h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                Mannaah exists to make one person's ability to help another
                simpler, more direct and less dependent on borders.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-y border-[#ddd2c1] bg-[#f8f4ec]">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8a765e]">
            Mannaah
          </p>

          <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#354438] sm:text-4xl">
            Help can cross borders.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl leading-7 text-muted-foreground">
            Browse campaigns, support someone directly, or create a campaign
            when you need help.
          </p>

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/campaigns">Browse campaigns</Link>
            </Button>

            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link to="/support-mannaah">Support Mannaah</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 py-10 text-center text-sm text-muted-foreground">
        {config.appName} · Help doesn't ask where you're from.
      </footer>
    </main>
  );
}

export default MannaahHomePage;
