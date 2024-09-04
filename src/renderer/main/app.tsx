import React from "react"

interface IAppProps {
  startTime: number
}

export default class App extends React.Component<IAppProps, any> {
  constructor(props: IAppProps) {
    super(props)
  }

  componentDidMount() {
    const now = performance.now()
    // @ts-ignore
    window.stument.rendererReady(now - this.props.startTime)
  }

  render() {
    return <div>App</div>
  }
}
